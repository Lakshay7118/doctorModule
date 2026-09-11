import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma";
import { prisma } from "../../db/prisma";
import { requirePermission, rejectAuditorWrites } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { AppError, notFound } from "../../utils/errors";
import type { RequestContext } from "../../types/security";
import { transition } from "./common";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(500);
const optionalText = z.string().trim().max(500).optional();
const dateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const workplaceQuery = z.object({ workplaceId: uuid.optional() }).strict();
const workplaceBody = z.object({ workplaceId: uuid.optional() }).strict();
const idParams = z.object({ id: uuid }).strict();

const receptionistAppointmentTransitions: Record<string, readonly string[]> = {
  SCHEDULED: ["CONFIRMED", "CHECKED_IN", "WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"],
  WAITING: ["IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_CONSULTATION: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
};

const createPatient = workplaceBody.extend({
  qlynoId: text,
  fullName: text,
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]),
  dateOfBirth: z.coerce.date().optional(),
  phone: optionalText,
  email: z.string().email().optional(),
  bloodGroup: optionalText,
  primaryDoctorId: uuid.optional(),
  localMrn: text,
  department: optionalText,
  address: optionalText,
  notes: optionalText,
});

const updatePatient = workplaceBody.extend({
  fullName: text.optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(),
  dateOfBirth: z.union([
    z.string().date().transform((value) => new Date(`${value}T00:00:00.000Z`)),
    z.null(),
  ]).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  bloodGroup: optionalText,
  department: optionalText,
  address: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();

const createAppointment = workplaceBody.extend({
  patientId: uuid,
  doctorId: uuid,
  scheduledAt: dateTime,
  durationMinutes: z.number().int().min(5).max(480).default(20),
  mode: z.enum(["IN_PERSON", "VIDEO", "HOME", "HOSPITAL"]).default("IN_PERSON"),
  reason: optionalText,
});

const appointmentStatus = workplaceBody.extend({
  status: z.enum(["CONFIRMED", "CHECKED_IN", "WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  reason: optionalText,
});

const checkIn = workplaceBody.extend({
  patientId: uuid,
  doctorId: uuid,
});

const createVisitor = workplaceBody.extend({
  patientId: uuid,
  name: text,
  phone: z.string().trim().min(0).max(30).default("Not recorded"),
  purpose: text,
});

const createAdmission = workplaceBody.extend({
  patientId: uuid,
  doctorId: uuid,
  ward: text,
  bed: text,
  admittedAt: dateTime.optional(),
});

const createEmergency = workplaceBody.extend({
  name: text,
  age: z.coerce.number().int().min(0).max(130).optional(),
  severity: z.enum(["Critical", "Serious", "Stable"]),
  doctorId: uuid,
  complaint: optionalText,
});

const createNotification = workplaceBody.extend({
  channel: z.enum(["SMS", "EMAIL", "SYSTEM", "CALL"]),
  recipient: text,
  subject: text,
  body: text,
});

const createReceptionistAction = workplaceBody.extend({
  action: z.enum(["PATIENT_CALLED", "OPD_STATUS_UPDATED", "CONSULTATION_SLIP_PRINTED", "TOKEN_SLIP_PRINTED", "VISITOR_PASS_PRINTED", "PROFILE_SAVED", "PRINTER_TESTED"]),
  subject: text,
  detail: text,
  relatedType: optionalText,
  relatedId: optionalText,
});

const generateReport = workplaceBody.extend({
  type: z.enum(["Patient registrations", "Appointments", "Admissions", "Cancellations", "Overall reception activity"]),
  range: z.enum(["Today", "This week", "This month", "Custom range"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).superRefine((value, ctx) => {
  if (value.endDate < value.startDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be after start date" });
});

const saveSettings = workplaceBody.extend({
  profile: z.object({
    displayName: text,
    counterNumber: text,
    defaultDepartmentView: text,
  }).strict().optional(),
  printers: z.object({
    tokenPrinter: text,
    visitorPassPrinter: text,
    testPrint: z.boolean().default(false),
  }).strict().optional(),
  security: z.object({
    sessionTimeoutMinutes: z.number().int().min(5).max(480),
    signOutAllSessions: z.boolean().default(false),
  }).strict().optional(),
  notificationPreferences: z.record(z.boolean()).optional(),
}).strict().refine((value) => Boolean(value.profile || value.printers || value.security || value.notificationPreferences));

const receptionistModulesByContext = {
  "solo-doctor": ["dashboard", "patient-directory", "appointments", "check-in", "billing", "communication", "reports", "settings", "search", "quick-actions", "follow-ups", "tasks", "documents", "coordination", "ai-assistant"],
  clinic: ["dashboard", "patient-directory", "appointments", "check-in", "opd", "billing", "communication", "reports", "settings", "search", "quick-actions", "follow-ups", "tasks", "documents", "coordination", "ai-assistant"],
  hospital: ["dashboard", "patient-directory", "appointments", "check-in", "opd", "ipd-admission", "visitors", "billing", "emergency", "communication", "reports", "settings", "search", "quick-actions", "follow-ups", "tasks", "documents", "coordination", "ai-assistant"],
} as const;

function receptionistContextForWorkplace(workplace: { id: string; name: string; type: string; timeZone: string }) {
  const type =
    workplace.type === "SOLO_PRACTICE" || workplace.type === "ONLINE_PRACTICE"
      ? "solo-doctor"
      : workplace.type === "CLINIC"
        ? "clinic"
        : "hospital";

  const label =
    type === "solo-doctor"
      ? "Solo Doctor Receptionist"
      : type === "clinic"
        ? "Clinic Receptionist"
        : "Hospital Receptionist";

  return {
    type,
    label,
    organizationName: workplace.name,
    workplaceId: workplace.id,
    timeZone: workplace.timeZone,
    ownerLabel: type === "solo-doctor" ? "Solo doctor" : type === "clinic" ? "Clinic admin" : "Hospital admin",
    scopeLabel:
      type === "solo-doctor"
        ? "One doctor practice"
        : type === "clinic"
          ? "Permitted clinic doctors, services and locations"
          : "Assigned hospital desks, departments and workflows",
    allowedModules: receptionistModulesByContext[type],
    permissions: {
      patientRegistration: true,
      appointments: true,
      checkInQueue: true,
      billing: true,
      communication: true,
      documents: true,
      followUps: true,
      tasks: true,
      whatsApp: true,
      aiAssistant: true,
      opdRouting: type !== "solo-doctor",
      admissions: type === "hospital",
      discharge: type === "hospital",
      visitors: type === "hospital",
      emergencyRouting: type === "hospital",
      diagnostics: true,
      pharmacy: true,
      clinicalAccess: false,
    },
    boundaries: [
      "Reception can update demographic and operational workflow data only.",
      "Clinical notes, diagnosis, report interpretation and medical decisions stay with clinical staff.",
      "Emergency questions must be routed to the configured clinical team.",
    ],
  };
}

function id() {
  return randomUUID();
}

function isTenantAdmin(context: RequestContext) {
  return context.roles.includes("tenant_admin");
}

async function resolveWorkplace(context: RequestContext, requestedWorkplaceId?: string) {
  const siteScope = isTenantAdmin(context) ? {} : { siteId: { in: context.siteIds } };
  const where = {
    tenantId: context.tenantId,
    status: "ACTIVE" as const,
    ...siteScope,
  };

  const workplace = requestedWorkplaceId
    ? await prisma.workplaces.findFirst({ where: { id: requestedWorkplaceId, ...where } })
    : await prisma.workplaces.findFirst({ where: { ...where, type: "HOSPITAL" }, orderBy: { createdAt: "asc" } }) ??
      await prisma.workplaces.findFirst({ where, orderBy: { createdAt: "asc" } });

  if (!workplace) throw notFound("Workplace");
  return workplace;
}

function ageFromBirthDate(value?: Date | null) {
  if (!value) return 0;
  const today = new Date();
  let age = today.getFullYear() - value.getFullYear();
  const monthDelta = today.getMonth() - value.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < value.getDate())) age -= 1;
  return Math.max(age, 0);
}

function birthDateForAge(age?: number) {
  if (!age && age !== 0) return undefined;
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear() - age, 0, 1));
}

function displayDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function displayTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function parseReceptionistSettings(body?: string | null) {
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, Prisma.InputJsonValue> : null;
  } catch {
    return null;
  }
}

function parseRegistrationDetails(body?: string | null) {
  if (!body) return {} as { address?: string; notes?: string };
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {} as { address?: string; notes?: string };
    const value = parsed as Record<string, unknown>;
    return {
      address: typeof value.address === "string" ? value.address : undefined,
      notes: typeof value.notes === "string" ? value.notes : undefined,
    };
  } catch {
    return {} as { address?: string; notes?: string };
  }
}

function patientStatus(row: { createdAt: Date; patient_workplaces: Array<{ status: string }> }) {
  if (row.patient_workplaces.some((item) => item.status !== "ACTIVE")) return "Deactivated";
  const createdToday = row.createdAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  return createdToday ? "New" : "Active";
}

function appointmentStatusForReception(status: string) {
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED" || status === "NO_SHOW") return "Cancelled";
  if (status === "SCHEDULED") return "Pending";
  return "Confirmed";
}

function queueStatusForReception(status: string) {
  if (status === "IN_CONSULTATION") return "In Consultation";
  if (status === "COMPLETED") return "Completed";
  return "Waiting";
}

function admissionStatusForReception(status: string) {
  if (status === "DISCHARGED") return "Discharged";
  if (status === "AWAITING_BED") return "Awaiting Bed";
  return "Admitted";
}

function billingStatusForReception(status: string) {
  if (status === "PAID") return "Paid";
  if (status === "PARTIALLY_PAID") return "Advance received";
  return "Pending";
}

function severityForReception(triageLevel: string) {
  if (triageLevel === "RESUSCITATION" || triageLevel === "EMERGENT") return "Critical";
  if (triageLevel === "URGENT") return "Serious";
  return "Stable";
}

function triageLevelForReception(severity: "Critical" | "Serious" | "Stable") {
  if (severity === "Critical") return "RESUSCITATION";
  if (severity === "Serious") return "URGENT";
  return "LESS_URGENT";
}

function genderForPatient(gender: string) {
  if (gender === "FEMALE") return "Female";
  if (gender === "MALE") return "Male";
  return "Other";
}

function backendGender(gender: "Male" | "Female" | "Other") {
  if (gender === "Female") return "FEMALE";
  if (gender === "Male") return "MALE";
  return "OTHER";
}

async function receptionistSnapshot(context: RequestContext, workplaceId?: string) {
  const workplace = await resolveWorkplace(context, workplaceId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [doctors, patients, appointments, queueAppointments, visitors, admissions, emergencyCases, billingRows, wards, outbox, followUps, tasks, orders, prescriptions, documents, profile, content, auditEvents] = await Promise.all([
    prisma.doctor_profiles.findMany({
      where: { doctor_workplaces: { some: { workplaceId: workplace.id, status: "ACTIVE" } } },
      include: { doctor_workplaces: { where: { workplaceId: workplace.id }, take: 1 } },
      orderBy: { fullName: "asc" },
    }),
    prisma.patients.findMany({
      where: { patient_workplaces: { some: { workplaceId: workplace.id } } },
      include: {
        doctor_profiles: true,
        patient_conditions: { orderBy: { updatedAt: "desc" }, take: 1 },
        patient_workplaces: { where: { workplaceId: workplace.id } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.appointments.findMany({
      where: { workplaceId: workplace.id },
      include: { patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } }, doctor_profiles: true },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    }),
    prisma.appointments.findMany({
      where: {
        workplaceId: workplace.id,
        checkedInAt: { gte: startOfToday, lt: endOfToday },
        status: { in: ["CHECKED_IN", "WAITING", "IN_CONSULTATION", "COMPLETED"] },
      },
      include: { patients: true, doctor_profiles: true },
      orderBy: { checkedInAt: "desc" },
      take: 100,
    }),
    prisma.hospitalVisitor.findMany({
      where: { tenantId: context.tenantId, workplaceId: workplace.id },
      include: { patients: true },
      orderBy: { checkedInAt: "desc" },
      take: 100,
    }),
    prisma.hospitalAdmission.findMany({
      where: { tenantId: context.tenantId, workplaceId: workplace.id },
      include: {
        patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } },
        bed: { include: { ward: true } },
        encounters: { include: { doctor_profiles: true } },
      },
      orderBy: { admittedAt: "desc" },
      take: 100,
    }),
    prisma.emergencyCase.findMany({
      where: { tenantId: context.tenantId, workplaceId: workplace.id },
      include: { patients: true, encounters: { include: { doctor_profiles: true } } },
      orderBy: { arrivedAt: "desc" },
      take: 100,
    }),
    prisma.billing_invoices.findMany({
      where: { workplaceId: workplace.id },
      include: {
        lines: { take: 1 },
        patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } },
      },
      orderBy: { issuedAt: "desc" },
      take: 100,
    }),
    prisma.hospitalWard.findMany({
      where: { tenantId: context.tenantId, workplaceId: workplace.id },
      orderBy: { name: "asc" },
    }),
    prisma.hospitalOutbox.findMany({
      where: { tenantId: context.tenantId, workplaceId: workplace.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.follow_ups.findMany({
      where: { workplaceId: workplace.id },
      include: { patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } }, doctor_profiles: true },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.tasks.findMany({
      where: { workplaceId: workplace.id },
      include: { patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } } },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.investigation_orders.findMany({
      where: { workplaceId: workplace.id },
      include: { patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } }, doctor_profiles: true },
      orderBy: { orderedAt: "desc" },
      take: 50,
    }),
    prisma.prescriptions.findMany({
      where: { workplaceId: workplace.id },
      include: { patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } }, doctor_profiles: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.hospitalDocument.findMany({
      where: { tenantId: context.tenantId, workplaceId: workplace.id },
      include: { patients: { include: { patient_workplaces: { where: { workplaceId: workplace.id } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.hospitalProfile.findUnique({
      where: { workplaceId: workplace.id },
    }),
    prisma.hospitalContent.findMany({
      where: { tenantId: context.tenantId, workplaceId: workplace.id, kind: { in: ["RECEPTIONIST_SETTINGS", "RECEPTIONIST_REPORT"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditEvent.findMany({
      where: { tenantId: context.tenantId, entity: "ReceptionistAction", entityId: workplace.id },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),
  ]);
  const latestSettings = content.find((item) => item.kind === "RECEPTIONIST_SETTINGS");
  const generatedReports = content.filter((item) => item.kind === "RECEPTIONIST_REPORT");
  const settingsPayload = parseReceptionistSettings(latestSettings?.body);
  const baseContext = receptionistContextForWorkplace(workplace);

  return {
    workplaceId: workplace.id,
    settings: settingsPayload,
    context: {
      ...baseContext,
      organizationName: profile?.description ? `${workplace.name}` : baseContext.organizationName,
    },
    doctors: doctors.map((doctor) => ({
      name: doctor.fullName,
      department: doctor.doctor_workplaces[0]?.department ?? doctor.specialty,
      backendId: doctor.id,
    })),
    wards: wards.map((ward) => ward.name),
    patients: patients.map((patient) => ({
      uhid: patient.patient_workplaces[0]?.localMrn ?? patient.qlynoId,
      backendId: patient.id,
      primaryDoctorId: patient.primaryDoctorId ?? undefined,
      workplaceId: workplace.id,
      name: patient.fullName,
      age: ageFromBirthDate(patient.dateOfBirth),
      gender: genderForPatient(patient.gender),
      phone: patient.phone ?? "Not added",
      department: patient.patient_conditions[0]?.name ?? patient.doctor_profiles?.specialty ?? "General Medicine",
      bloodGroup: patient.bloodGroup ?? undefined,
      lastVisit: displayDate(patient.createdAt),
      status: patientStatus(patient),
    })),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      backendId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      workplaceId: appointment.workplaceId,
      patient: appointment.patients.fullName,
      uhid: appointment.patients.patient_workplaces[0]?.localMrn ?? appointment.patients.qlynoId,
      doctor: appointment.doctor_profiles.fullName,
      department: appointment.doctor_profiles.specialty,
      date: displayDate(appointment.scheduledAt),
      time: displayTime(appointment.scheduledAt),
      status: appointmentStatusForReception(appointment.status),
    })),
    queue: queueAppointments.map((appointment, index) => ({
      token: `T-${String(index + 1).padStart(3, "0")}`,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      workplaceId: appointment.workplaceId,
      patient: appointment.patients.fullName,
      doctor: appointment.doctor_profiles.fullName,
      department: appointment.doctor_profiles.specialty,
      checkedInAt: displayTime(appointment.checkedInAt ?? appointment.scheduledAt),
      status: queueStatusForReception(appointment.status),
    })),
    visitors: visitors.map((visitor) => ({
      id: visitor.id,
      patientId: visitor.patientId,
      name: visitor.name,
      visiting: visitor.patients.fullName,
      ward: visitor.purpose.split(" - ")[1] ?? "General Ward",
      relation: visitor.purpose.split(" - ")[0] ?? visitor.purpose,
      passIssued: displayTime(visitor.checkedInAt),
      status: visitor.checkedOutAt ? "Checked Out" : "Checked In",
    })),
    admissions: admissions.map((admission) => ({
      id: admission.id,
      backendId: admission.id,
      patientId: admission.patientId,
      doctorId: admission.encounters.doctorId,
      workplaceId: admission.workplaceId,
      patient: admission.patients.fullName,
      uhid: admission.patients.patient_workplaces[0]?.localMrn ?? admission.patients.qlynoId,
      ward: admission.bed.ward.name,
      bed: admission.bed.code,
      doctor: admission.encounters.doctor_profiles.fullName,
      admittedOn: displayDate(admission.admittedAt),
      status: admissionStatusForReception(admission.status),
    })),
    emergencyCases: emergencyCases.map((emergency) => ({
      id: emergency.id,
      backendId: emergency.id,
      patientId: emergency.patientId,
      doctorId: emergency.encounters.doctorId,
      workplaceId: emergency.workplaceId,
      name: emergency.patients.fullName,
      age: emergency.patients.dateOfBirth ? String(ageFromBirthDate(emergency.patients.dateOfBirth)) : "Unknown",
      severity: severityForReception(emergency.triageLevel),
      doctor: emergency.encounters.doctor_profiles.fullName,
      arrivedAt: displayTime(emergency.arrivedAt),
    })),
    billingRows: billingRows.map((invoice) => ({
      id: invoice.invoiceNumber,
      backendId: invoice.id,
      patientId: invoice.patientId,
      workplaceId: invoice.workplaceId,
      patient: invoice.patients.fullName,
      uhid: invoice.patients.patient_workplaces[0]?.localMrn ?? invoice.patients.qlynoId,
      item: invoice.lines[0]?.description ?? invoice.notes ?? "Hospital invoice",
      amount: Number(invoice.total),
      status: billingStatusForReception(invoice.status),
    })),
    notifications: outbox.map((message) => ({
      id: message.id,
      title: message.subject,
      detail: message.body,
      time: displayTime(message.createdAt),
      channel: message.channel === "EMAIL" ? "Email" : message.channel === "SMS" ? "SMS" : message.channel === "CALL" ? "Call" : "System",
      recipient: message.recipient,
    })),
    followUps: followUps.map((followUp) => ({
      id: followUp.id,
      patientId: followUp.patientId,
      doctorId: followUp.doctorId,
      workplaceId: followUp.workplaceId,
      patient: followUp.patients.fullName,
      uhid: followUp.patients.patient_workplaces[0]?.localMrn ?? followUp.patients.qlynoId,
      doctor: followUp.doctor_profiles.fullName,
      dueAt: followUp.dueAt ? displayDate(followUp.dueAt) : "Not scheduled",
      reason: followUp.reason,
      status: followUp.status === "DUE_TODAY" ? "Due Today" : followUp.status.charAt(0) + followUp.status.slice(1).toLowerCase().replace(/_/g, " "),
      owner: followUp.owner,
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      patientId: task.patientId ?? undefined,
      workplaceId: task.workplaceId ?? undefined,
      patient: task.patients?.fullName ?? "General reception",
      uhid: task.patients?.patient_workplaces[0]?.localMrn ?? task.patients?.qlynoId ?? "-",
      title: task.title,
      description: task.description ?? "Administrative reception task",
      dueAt: task.dueAt ? displayDate(task.dueAt) : "No due date",
      status: task.status.charAt(0) + task.status.slice(1).toLowerCase().replace(/_/g, " "),
      priority: task.priority.charAt(0) + task.priority.slice(1).toLowerCase(),
    })),
    coordination: [
      ...orders.map((order) => ({
        id: order.id,
        patientId: order.patientId,
        workplaceId: order.workplaceId,
        patient: order.patients.fullName,
        uhid: order.patients.patient_workplaces[0]?.localMrn ?? order.patients.qlynoId,
        owner: order.doctor_profiles.fullName,
        type: order.type === "LABORATORY" ? "Diagnostics" : order.type === "RADIOLOGY" ? "Radiology" : "External report",
        title: order.title,
        status: order.status.charAt(0) + order.status.slice(1).toLowerCase().replace(/_/g, " "),
        date: displayDate(order.orderedAt),
        boundary: "Status coordination only; report interpretation is routed to clinical staff.",
      })),
      ...prescriptions.map((prescription) => ({
        id: prescription.id,
        patientId: prescription.patientId,
        workplaceId: prescription.workplaceId,
        patient: prescription.patients.fullName,
        uhid: prescription.patients.patient_workplaces[0]?.localMrn ?? prescription.patients.qlynoId,
        owner: prescription.doctor_profiles.fullName,
        type: "Pharmacy",
        title: "Prescription fulfillment",
        status: prescription.status.charAt(0) + prescription.status.slice(1).toLowerCase(),
        date: displayDate(prescription.issuedAt ?? prescription.createdAt),
        boundary: "Operational fulfillment status only; orders remain controlled by the doctor.",
      })),
    ],
    documents: [
      ...documents.map((document) => ({
        id: document.id,
        patientId: document.patientId ?? undefined,
        workplaceId: document.workplaceId,
        patient: document.patients?.fullName ?? "Hospital document",
        uhid: document.patients?.patient_workplaces[0]?.localMrn ?? document.patients?.qlynoId ?? "-",
        title: document.title,
        category: document.category,
        uploadedAt: displayDate(document.createdAt),
        status: document.expiresAt && document.expiresAt < new Date() ? "Expired" : "On file",
      })),
      ...generatedReports.map((report) => ({
        id: report.id,
        workplaceId: report.workplaceId,
        patient: "Reception report",
        uhid: "-",
        title: report.title,
        category: "REPORT",
        uploadedAt: displayDate(report.createdAt),
        status: "On file",
      })),
    ],
    auditTrail: [
      ...outbox.map((message) => ({
        id: message.id,
        action: message.subject,
        detail: message.body,
        actor: "Reception",
        time: displayTime(message.createdAt),
        workplaceId: message.workplaceId,
        _sortAt: message.createdAt.getTime(),
      })),
      ...auditEvents.map((event) => ({
        id: event.id,
        action: event.action,
        detail: typeof event.afterState === "object" && event.afterState && "detail" in event.afterState ? String(event.afterState.detail) : "Reception action saved.",
        actor: "Reception",
        time: displayTime(event.timestamp),
        workplaceId: workplace.id,
        _sortAt: event.timestamp.getTime(),
      })),
    ].sort((a, b) => b._sortAt - a._sortAt).map(({ _sortAt, ...item }) => item),
  };
}

async function ensureDoctorAtWorkplace(doctorId: string, workplaceId: string) {
  const row = await prisma.doctor_profiles.findFirst({
    where: { id: doctorId, doctor_workplaces: { some: { workplaceId, status: "ACTIVE" } } },
  });
  if (!row) throw notFound("Doctor");
  return row;
}

async function ensurePatientAtWorkplace(patientId: string, workplaceId: string) {
  const row = await prisma.patients.findFirst({
    where: { id: patientId, patient_workplaces: { some: { workplaceId, status: "ACTIVE" } } },
  });
  if (!row) throw notFound("Patient");
  return row;
}

async function auditActorId(context: RequestContext) {
  const actor = await prisma.user.findUnique({ where: { id: context.userId }, select: { id: true } });
  return actor?.id;
}

async function writeOutbox(context: RequestContext, workplaceId: string, subject: string, body: string) {
  const actorUserId = await auditActorId(context);
  await prisma.$transaction([
    prisma.hospitalOutbox.create({
      data: {
        tenantId: context.tenantId,
        workplaceId,
        channel: "SYSTEM",
        recipient: "front-desk",
        subject,
        body,
      },
    }),
    prisma.auditEvent.create({
      data: {
        tenantId: context.tenantId,
        actorUserId,
        entity: "ReceptionistAction",
        entityId: workplaceId,
        action: subject,
        afterState: { detail: body },
      },
    }),
  ]);
}

async function writeReceptionistAction(context: RequestContext, workplaceId: string, subject: string, body: string, metadata: Prisma.InputJsonObject = {}) {
  const actorUserId = await auditActorId(context);
  await prisma.$transaction([
    prisma.hospitalOutbox.create({
      data: { tenantId: context.tenantId, workplaceId, channel: "SYSTEM", recipient: "front-desk", subject, body },
    }),
    prisma.auditEvent.create({
      data: {
        tenantId: context.tenantId,
        actorUserId,
        entity: "ReceptionistAction",
        entityId: workplaceId,
        action: subject,
        afterState: { detail: body, ...metadata },
      },
    }),
  ]);
}

export function receptionist(router: Router) {
  router.get(
    "/receptionist/bootstrap",
    requirePermission("hms.read"),
    validate({ query: workplaceQuery }),
    asyncHandler(async (req, res) => {
      res.json({ data: await receptionistSnapshot(req.context!, req.query.workplaceId as string | undefined) });
    })
  );

  router.post(
    "/receptionist/patients",
    requirePermission("hms.patients.write"),
    rejectAuditorWrites,
    validate({ body: createPatient }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const now = new Date();
      const patient = await prisma.$transaction(async (tx) => {
        const created = await tx.patients.create({
          data: {
            id: id(),
            qlynoId: req.body.qlynoId,
            fullName: req.body.fullName,
            gender: req.body.gender,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            email: req.body.email,
            bloodGroup: req.body.bloodGroup,
            primaryDoctorId: req.body.primaryDoctorId,
            updatedAt: now,
          },
        });
        await tx.patient_workplaces.create({
          data: {
            id: id(),
            patientId: created.id,
            workplaceId: workplace.id,
            localMrn: req.body.localMrn,
            updatedAt: now,
          },
        });
        if (req.body.department) {
          await tx.patient_conditions.create({
            data: { id: id(), patientId: created.id, name: req.body.department, updatedAt: now },
          });
        }
        if (req.body.address || req.body.notes) {
          await tx.document_assets.create({
            data: {
              id: id(),
              patientId: created.id,
              title: "Reception registration details",
              mimeType: "application/json",
              storagePath: `reception/${workplace.id}/patients/${created.id}/registration-details.json`,
              notes: JSON.stringify({ address: req.body.address ?? null, notes: req.body.notes ?? null }),
              updatedAt: now,
            },
          });
        }
        return created;
      });
      await writeOutbox(context, workplace.id, "Patient registered", `${patient.fullName} registered with ${req.body.localMrn}.`);
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.get(
    "/receptionist/patients/:id",
    requirePermission("hms.patients.read"),
    validate({ params: idParams, query: workplaceQuery }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.query.workplaceId as string | undefined);
      const patient = await prisma.patients.findFirst({
        where: { id: req.params.id, patient_workplaces: { some: { workplaceId: workplace.id } } },
        include: {
          patient_workplaces: { where: { workplaceId: workplace.id }, take: 1 },
          patient_conditions: { orderBy: { updatedAt: "desc" }, take: 1 },
          document_assets: { where: { title: "Reception registration details" }, orderBy: { updatedAt: "desc" }, take: 1 },
        },
      });

      if (!patient) throw notFound("Patient");
      const details = parseRegistrationDetails(patient.document_assets[0]?.notes);
      res.json({
        data: {
          id: patient.id,
          uhid: patient.patient_workplaces[0]?.localMrn ?? patient.qlynoId,
          name: patient.fullName,
          age: ageFromBirthDate(patient.dateOfBirth),
          dateOfBirth: patient.dateOfBirth?.toISOString().slice(0, 10) ?? null,
          gender: genderForPatient(patient.gender),
          phone: patient.phone ?? "",
          email: patient.email ?? "",
          bloodGroup: patient.bloodGroup ?? "",
          department: patient.patient_conditions[0]?.name ?? "General Medicine",
          address: details.address ?? "",
          notes: details.notes ?? "",
          workplaceId: workplace.id,
          status: patient.patient_workplaces[0]?.status === "ACTIVE" ? "Active" : "Deactivated",
          createdAt: patient.createdAt.toISOString(),
          updatedAt: patient.updatedAt.toISOString(),
        },
      });
    })
  );

  router.patch(
    "/receptionist/patients/:id",
    requirePermission("hms.patients.write"),
    rejectAuditorWrites,
    validate({ params: idParams, body: updatePatient }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const patientId = req.params.id as string;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const link = await prisma.patient_workplaces.findFirst({ where: { patientId, workplaceId: workplace.id } });
      if (!link) throw notFound("Patient");

      const { workplaceId: _workplaceId, department, address, notes, email, ...patientData } = req.body;
      await prisma.$transaction(async (tx) => {
        await tx.patients.update({
          where: { id: patientId },
          data: { ...patientData, email: email === "" ? null : email, updatedAt: new Date() },
        });

        if (department !== undefined) {
          const condition = await tx.patient_conditions.findFirst({
            where: { patientId },
            orderBy: { updatedAt: "desc" },
          });
          if (condition) {
            await tx.patient_conditions.update({ where: { id: condition.id }, data: { name: department, updatedAt: new Date() } });
          } else {
            await tx.patient_conditions.create({ data: { id: id(), patientId, name: department, updatedAt: new Date() } });
          }
        }

        if (address !== undefined || notes !== undefined) {
          const existing = await tx.document_assets.findFirst({
            where: { patientId, title: "Reception registration details" },
            orderBy: { updatedAt: "desc" },
          });
          const current = parseRegistrationDetails(existing?.notes);
          const registrationDetails = {
            address: address ?? current.address ?? null,
            notes: notes ?? current.notes ?? null,
          };
          if (existing) {
            await tx.document_assets.update({
              where: { id: existing.id },
              data: { notes: JSON.stringify(registrationDetails), updatedAt: new Date() },
            });
          } else {
            await tx.document_assets.create({
              data: {
                id: id(),
                patientId,
                title: "Reception registration details",
                mimeType: "application/json",
                storagePath: `reception/${workplace.id}/patients/${patientId}/registration-details.json`,
                notes: JSON.stringify(registrationDetails),
                updatedAt: new Date(),
              },
            });
          }
        }
      });

      await writeOutbox(context, workplace.id, "Patient details updated", `Patient ${patientId} details were updated by reception.`);
      res.json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/patients/:id/deactivate",
    requirePermission("hms.patients.write"),
    rejectAuditorWrites,
    validate({ params: idParams, body: workplaceBody }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const link = await prisma.patient_workplaces.findFirst({ where: { patientId: req.params.id, workplaceId: workplace.id } });
      if (!link) throw notFound("Patient");
      if (link.status !== "ACTIVE") {
        res.json({ data: await receptionistSnapshot(context, workplace.id) });
        return;
      }

      await prisma.patient_workplaces.update({ where: { id: link.id }, data: { status: "INACTIVE", updatedAt: new Date() } });
      await writeOutbox(context, workplace.id, "Patient deactivated", `Patient ${req.params.id} was deactivated by reception.`);
      res.json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/appointments",
    requirePermission("hms.appointments.write"),
    rejectAuditorWrites,
    validate({ body: createAppointment }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      if (req.body.scheduledAt <= new Date()) throw new AppError(400, "Appointment time must be in the future", "VALIDATION_ERROR");
      await ensurePatientAtWorkplace(req.body.patientId, workplace.id);
      await ensureDoctorAtWorkplace(req.body.doctorId, workplace.id);
      const end = new Date(req.body.scheduledAt.getTime() + req.body.durationMinutes * 60000);
      const conflict = await prisma.appointments.findFirst({
        where: {
          doctorId: req.body.doctorId,
          status: { notIn: ["CANCELLED", "NO_SHOW", "RESCHEDULED"] },
          scheduledAt: { lt: end, gt: new Date(req.body.scheduledAt.getTime() - 480 * 60000) },
        },
      });
      if (conflict && conflict.scheduledAt.getTime() + conflict.durationMinutes * 60000 > req.body.scheduledAt.getTime()) {
        throw new AppError(409, "Doctor is already booked", "SLOT_CONFLICT");
      }
      await prisma.appointments.create({
        data: {
          id: id(),
          patientId: req.body.patientId,
          doctorId: req.body.doctorId,
          workplaceId: workplace.id,
          scheduledAt: req.body.scheduledAt,
          durationMinutes: req.body.durationMinutes,
          mode: req.body.mode,
          reason: req.body.reason,
          status: "CONFIRMED",
          updatedAt: new Date(),
        },
      });
      await writeOutbox(context, workplace.id, "Appointment booked", "Appointment was booked by reception.");
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.get(
    "/receptionist/appointments/:id/slip",
    requirePermission("hms.appointments.read"),
    validate({ params: idParams, query: workplaceQuery }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.query.workplaceId as string | undefined);
      const appointment = await prisma.appointments.findFirst({
        where: { id: req.params.id, workplaceId: workplace.id },
        include: {
          patients: {
            include: {
              patient_workplaces: { where: { workplaceId: workplace.id }, take: 1 },
            },
          },
          doctor_profiles: true,
        },
      });

      if (!appointment) throw notFound("Appointment");

      res.json({
        data: {
          id: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          workplaceId: appointment.workplaceId,
          organizationName: workplace.name,
          patient: {
            id: appointment.patients.id,
            name: appointment.patients.fullName,
            uhid: appointment.patients.patient_workplaces[0]?.localMrn ?? appointment.patients.qlynoId,
            age: ageFromBirthDate(appointment.patients.dateOfBirth),
            gender: genderForPatient(appointment.patients.gender),
            phone: appointment.patients.phone ?? "Not added",
          },
          doctor: {
            id: appointment.doctor_profiles.id,
            name: appointment.doctor_profiles.fullName,
            department: appointment.doctor_profiles.specialty,
          },
          date: displayDate(appointment.scheduledAt),
          time: displayTime(appointment.scheduledAt),
          scheduledAt: appointment.scheduledAt.toISOString(),
          status: appointment.status,
          mode: appointment.mode,
          reason: appointment.reason,
          checkedInAt: appointment.checkedInAt ? displayTime(appointment.checkedInAt) : null,
          generatedAt: new Date().toISOString(),
        },
      });
    })
  );

  router.patch(
    "/receptionist/appointments/:id/status",
    requirePermission("hms.appointments.write"),
    rejectAuditorWrites,
    validate({ params: idParams, body: appointmentStatus }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const row = await prisma.appointments.findFirst({ where: { id: req.params.id, workplaceId: workplace.id } });
      if (!row) throw notFound("Appointment");
      transition(row.status, req.body.status, receptionistAppointmentTransitions);
      await prisma.appointments.update({
        where: { id: row.id },
        data: {
          status: req.body.status,
          updatedAt: new Date(),
          checkedInAt: ["CHECKED_IN", "WAITING"].includes(req.body.status) ? new Date() : row.checkedInAt,
          cancellationReason: req.body.status === "CANCELLED" ? req.body.reason : row.cancellationReason,
          cancelledAt: req.body.status === "CANCELLED" ? new Date() : row.cancelledAt,
          completedAt: req.body.status === "COMPLETED" ? new Date() : row.completedAt,
        },
      });
      await writeOutbox(context, workplace.id, "Appointment status updated", `Appointment ${row.id} moved from ${row.status} to ${req.body.status}.`);
      res.json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/check-ins",
    requirePermission("hms.appointments.write"),
    rejectAuditorWrites,
    validate({ body: checkIn }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      await ensurePatientAtWorkplace(req.body.patientId, workplace.id);
      await ensureDoctorAtWorkplace(req.body.doctorId, workplace.id);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const existing = await prisma.appointments.findFirst({
        where: {
          workplaceId: workplace.id,
          patientId: req.body.patientId,
          doctorId: req.body.doctorId,
          scheduledAt: { gte: start, lt: end },
          status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
        },
        orderBy: { scheduledAt: "asc" },
      });
      if (existing) {
        transition(existing.status, "WAITING", receptionistAppointmentTransitions);
        await prisma.appointments.update({
          where: { id: existing.id },
          data: { status: "WAITING", checkedInAt: new Date(), updatedAt: new Date() },
        });
      } else {
        await prisma.appointments.create({
          data: {
            id: id(),
            patientId: req.body.patientId,
            doctorId: req.body.doctorId,
            workplaceId: workplace.id,
            scheduledAt: new Date(),
            durationMinutes: 20,
            mode: "IN_PERSON",
            status: "WAITING",
            reason: "Walk-in OPD check-in",
            checkedInAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      await writeOutbox(context, workplace.id, "Patient checked in", "Patient was added to the reception queue.");
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/visitors",
    requirePermission("hms.visitors.write"),
    rejectAuditorWrites,
    validate({ body: createVisitor }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      await ensurePatientAtWorkplace(req.body.patientId, workplace.id);
      await prisma.hospitalVisitor.create({
        data: {
          tenantId: context.tenantId,
          workplaceId: workplace.id,
          patientId: req.body.patientId,
          name: req.body.name,
          phone: req.body.phone || "Not recorded",
          purpose: req.body.purpose,
        },
      });
      await writeOutbox(context, workplace.id, "Visitor pass issued", `${req.body.name} checked in for patient visitation.`);
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/visitors/:id/check-out",
    requirePermission("hms.visitors.write"),
    rejectAuditorWrites,
    validate({ params: idParams, body: workplaceBody }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const row = await prisma.hospitalVisitor.findFirst({ where: { id: req.params.id, tenantId: context.tenantId, workplaceId: workplace.id } });
      if (!row) throw notFound("Visitor");
      if (!row.checkedOutAt) await prisma.hospitalVisitor.update({ where: { id: row.id }, data: { checkedOutAt: new Date() } });
      await writeOutbox(context, workplace.id, "Visitor checked out", `Visitor pass ${row.id} was checked out.`);
      res.json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/admissions",
    requirePermission("hms.admissions.write"),
    rejectAuditorWrites,
    validate({ body: createAdmission }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      await ensurePatientAtWorkplace(req.body.patientId, workplace.id);
      await ensureDoctorAtWorkplace(req.body.doctorId, workplace.id);
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const ward = await tx.hospitalWard.upsert({
          where: { workplaceId_name: { workplaceId: workplace.id, name: req.body.ward } },
          create: { tenantId: context.tenantId, workplaceId: workplace.id, name: req.body.ward, type: "GENERAL" },
          update: {},
        });
        const bed = await tx.hospitalBed.upsert({
          where: { workplaceId_code: { workplaceId: workplace.id, code: req.body.bed } },
          create: { tenantId: context.tenantId, workplaceId: workplace.id, wardId: ward.id, code: req.body.bed, status: "AVAILABLE", dailyRate: new Prisma.Decimal(0) },
          update: { wardId: ward.id },
        });
        if (bed.status !== "AVAILABLE") throw new AppError(409, "Bed is unavailable", "BED_UNAVAILABLE");
        if (await tx.hospitalAdmission.findFirst({ where: { patientId: req.body.patientId, status: "ADMITTED" } })) {
          throw new AppError(409, "Patient already has an active admission", "ADMISSION_CONFLICT");
        }
        const encounter = await tx.encounters.create({
          data: {
            id: id(),
            patientId: req.body.patientId,
            doctorId: req.body.doctorId,
            workplaceId: workplace.id,
            type: "INPATIENT_ROUND",
            status: "ADMITTED",
            chiefComplaint: "Reception IPD admission",
            startedAt: req.body.admittedAt ?? now,
            updatedAt: now,
          },
        });
        await tx.hospitalBed.update({ where: { id: bed.id }, data: { status: "OCCUPIED" } });
        await tx.hospitalAdmission.create({
          data: {
            tenantId: context.tenantId,
            workplaceId: workplace.id,
            patientId: req.body.patientId,
            encounterId: encounter.id,
            bedId: bed.id,
            admittedAt: req.body.admittedAt ?? now,
          },
        });
      });
      await writeOutbox(context, workplace.id, "Patient admitted", `Patient admitted to ${req.body.ward} / ${req.body.bed}.`);
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/emergency-cases",
    requirePermission("hms.patients.write"),
    rejectAuditorWrites,
    validate({ body: createEmergency }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const doctor = await ensureDoctorAtWorkplace(req.body.doctorId, workplace.id);
      const now = new Date();
      const qlynoId = `ER-${Date.now()}`;
      await prisma.$transaction(async (tx) => {
        const patient = await tx.patients.create({
          data: {
            id: id(),
            qlynoId,
            fullName: req.body.name,
            gender: "UNKNOWN",
            dateOfBirth: birthDateForAge(req.body.age),
            updatedAt: now,
          },
        });
        await tx.patient_workplaces.create({
          data: {
            id: id(),
            patientId: patient.id,
            workplaceId: workplace.id,
            localMrn: qlynoId,
            updatedAt: now,
          },
        });
        const encounter = await tx.encounters.create({
          data: {
            id: id(),
            patientId: patient.id,
            doctorId: doctor.id,
            workplaceId: workplace.id,
            type: "EMERGENCY",
            status: "WAITING",
            chiefComplaint: req.body.complaint ?? "Emergency front desk arrival",
            startedAt: now,
            updatedAt: now,
          },
        });
        await tx.emergencyCase.create({
          data: {
            tenantId: context.tenantId,
            workplaceId: workplace.id,
            patientId: patient.id,
            encounterId: encounter.id,
            triageLevel: triageLevelForReception(req.body.severity),
            complaint: req.body.complaint ?? req.body.name,
            status: "WAITING",
          },
        });
      });
      await writeOutbox(context, workplace.id, "Emergency registered", `${req.body.name} routed to ${doctor.fullName}.`);
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/notifications",
    requirePermission("hms.communication.write"),
    rejectAuditorWrites,
    validate({ body: createNotification }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      await prisma.$transaction([
        prisma.hospitalOutbox.create({
          data: {
            tenantId: context.tenantId,
            workplaceId: workplace.id,
            channel: req.body.channel,
            recipient: req.body.recipient,
            subject: req.body.subject,
            body: req.body.body,
          },
        }),
        prisma.auditEvent.create({
          data: {
            tenantId: context.tenantId,
            actorUserId: context.userId,
            entity: "ReceptionistAction",
            entityId: workplace.id,
            action: "Staff message sent",
            afterState: { detail: req.body.body, channel: req.body.channel, recipient: req.body.recipient },
          },
        }),
      ]);
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/actions",
    requirePermission("hms.appointments.write"),
    rejectAuditorWrites,
    validate({ body: createReceptionistAction }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      await writeReceptionistAction(context, workplace.id, req.body.subject, req.body.detail, {
        action: req.body.action,
        relatedType: req.body.relatedType ?? null,
        relatedId: req.body.relatedId ?? null,
      });
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );

  router.post(
    "/receptionist/reports",
    requirePermission("hms.read"),
    rejectAuditorWrites,
    validate({ body: generateReport }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const endExclusive = new Date(req.body.endDate);
      endExclusive.setDate(endExclusive.getDate() + 1);
      const range = { gte: req.body.startDate, lt: endExclusive };
      const [patientRegistrations, appointments, cancellations, admissions, messages] = await Promise.all([
        prisma.patient_workplaces.count({ where: { workplaceId: workplace.id, createdAt: range } }),
        prisma.appointments.count({ where: { workplaceId: workplace.id, scheduledAt: range } }),
        prisma.appointments.count({ where: { workplaceId: workplace.id, status: { in: ["CANCELLED", "NO_SHOW"] }, scheduledAt: range } }),
        prisma.hospitalAdmission.count({ where: { tenantId: context.tenantId, workplaceId: workplace.id, admittedAt: range } }),
        prisma.hospitalOutbox.count({ where: { tenantId: context.tenantId, workplaceId: workplace.id, createdAt: range } }),
      ]);
      const summary = { patientRegistrations, appointments, cancellations, admissions, messages };
      await prisma.hospitalContent.create({
        data: {
          tenantId: context.tenantId,
          workplaceId: workplace.id,
          title: `${req.body.type} - ${displayDate(req.body.startDate)} to ${displayDate(req.body.endDate)}`,
          kind: "RECEPTIONIST_REPORT",
          body: JSON.stringify({ type: req.body.type, range: req.body.range, startDate: req.body.startDate, endDate: req.body.endDate, summary }),
          status: "PUBLISHED",
          authorUserId: context.userId,
          publishedAt: new Date(),
        },
      });
      await writeReceptionistAction(context, workplace.id, "Reception report generated", `${req.body.type} report generated.`, summary);
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id), report: summary });
    })
  );

  router.post(
    "/receptionist/settings",
    requirePermission("hms.read"),
    rejectAuditorWrites,
    validate({ body: saveSettings }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveWorkplace(context, req.body.workplaceId);
      const savedAt = new Date();
      const previous = await prisma.hospitalContent.findFirst({
        where: { tenantId: context.tenantId, workplaceId: workplace.id, kind: "RECEPTIONIST_SETTINGS" },
        orderBy: { createdAt: "desc" },
      });
      const previousSettings = parseReceptionistSettings(previous?.body);
      const body: Prisma.InputJsonObject = {
        profile: req.body.profile ?? previousSettings?.profile ?? null,
        printers: req.body.printers ?? previousSettings?.printers ?? null,
        security: req.body.security ?? previousSettings?.security ?? null,
        notificationPreferences: req.body.notificationPreferences ?? previousSettings?.notificationPreferences ?? null,
        savedAt: savedAt.toISOString(),
      };
      const profileSettings = body.profile && typeof body.profile === "object" && !Array.isArray(body.profile) ? body.profile as Record<string, Prisma.InputJsonValue> : null;
      const displayName = typeof profileSettings?.displayName === "string" ? profileSettings.displayName : "Reception profile";
      await prisma.$transaction([
        prisma.hospitalProfile.upsert({
          where: { workplaceId: workplace.id },
          create: {
            tenantId: context.tenantId,
            workplaceId: workplace.id,
            description: displayName,
          },
          update: {
            description: displayName,
          },
        }),
        prisma.hospitalContent.create({
          data: {
            tenantId: context.tenantId,
            workplaceId: workplace.id,
            title: "Receptionist settings",
            kind: "RECEPTIONIST_SETTINGS",
            body: JSON.stringify(body),
            status: "PUBLISHED",
            authorUserId: context.userId,
            publishedAt: savedAt,
          },
        }),
      ]);
      await writeReceptionistAction(context, workplace.id, "Reception settings saved", "Reception settings updated.", body);
      res.status(201).json({ data: await receptionistSnapshot(context, workplace.id) });
    })
  );
}
