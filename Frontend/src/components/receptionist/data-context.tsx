"use client";

import * as React from "react";
import {
  ApiSyncSkippedError,
  isUuid,
  createBackendReceptionistAdmission,
  createBackendReceptionistAppointment,
  createBackendReceptionistAction,
  createBackendReceptionistCheckIn,
  createBackendReceptionistEmergencyCase,
  createBackendReceptionistNotification,
  createBackendReceptionistPatient,
  createBackendReceptionistVisitor,
  deactivateBackendReceptionistPatient,
  generateBackendReceptionistReport,
  checkOutBackendReceptionistVisitor,
  getBackendReceptionistBootstrap,
  saveBackendReceptionistSettings,
  updateBackendReceptionistAppointmentStatus,
  updateBackendReceptionistPatient,
} from "@/lib/api-client";
import type {
  BackendReceptionistAuditTrail,
  BackendReceptionistContext,
  BackendReceptionistCoordinationRow,
  BackendReceptionistDocument,
  BackendReceptionistFollowUp,
  BackendReceptionistSettings,
  BackendReceptionistTask,
} from "@/lib/api-client";
import { Card, SectionSkeleton, Skeleton } from "@/components/ui";
import {
  Patient,
  Appointment,
  QueueEntry,
  Visitor,
  Admission,
  ReceptionistDoctor,
  generateUHID,
  generateToken,
} from "./mock-data";
import { formatReceptionistDate, parseReceptionistDate } from "./date-utils";

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  channel: "SMS" | "Email" | "System" | "Call";
  recipient?: string;
}

export interface EmergencyCase {
  id: string;
  backendId?: string;
  patientId?: string;
  doctorId?: string;
  workplaceId?: string;
  name: string;
  age: string;
  severity: "Critical" | "Serious" | "Stable";
  doctor: string;
  arrivedAt: string;
}

export interface BillingRow {
  id: string;
  backendId?: string;
  patientId?: string;
  workplaceId?: string;
  patient: string;
  uhid: string;
  item: string;
  amount: number;
  status: "Paid" | "Pending" | "Advance received";
}

const defaultReceptionistContext: BackendReceptionistContext = {
  type: "hospital",
  label: "Hospital Receptionist",
  organizationName: "Hospital",
  workplaceId: "",
  timeZone: "Asia/Kolkata",
  ownerLabel: "Hospital admin",
  scopeLabel: "Assigned hospital desks, departments and workflows",
  allowedModules: [
    "dashboard",
    "patient-directory",
    "appointments",
    "check-in",
    "opd",
    "ipd-admission",
    "visitors",
    "billing",
    "emergency",
    "communication",
    "reports",
    "settings",
    "search",
    "quick-actions",
    "follow-ups",
    "tasks",
    "documents",
    "coordination",
    "ai-assistant",
  ],
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
    opdRouting: true,
    admissions: true,
    discharge: true,
    visitors: true,
    emergencyRouting: true,
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

interface ReceptionistData {
  context: BackendReceptionistContext;
  doctors: ReceptionistDoctor[];
  wards: string[];
  patients: Patient[];
  appointments: Appointment[];
  queue: QueueEntry[];
  visitors: Visitor[];
  admissions: Admission[];
  emergencyCases: EmergencyCase[];
  billingRows: BillingRow[];
  notifications: NotificationItem[];
  followUps: BackendReceptionistFollowUp[];
  tasks: BackendReceptionistTask[];
  coordination: BackendReceptionistCoordinationRow[];
  documents: BackendReceptionistDocument[];
  auditTrail: BackendReceptionistAuditTrail[];
  settings: BackendReceptionistSettings | null;
  addPatient: (p: Omit<Patient, "uhid"> & { email?: string; address?: string; notes?: string }) => Promise<Patient>;
  updatePatient: (id: string, input: Parameters<typeof updateBackendReceptionistPatient>[1]) => Promise<void>;
  deactivatePatient: (id: string, workplaceId?: string) => Promise<void>;
  addAppointment: (a: Omit<Appointment, "id">) => Promise<Appointment>;
  updateAppointmentStatus: (id: string, status: Appointment["status"]) => void;
  checkIn: (q: Omit<QueueEntry, "token">) => QueueEntry;
  advanceQueueStatus: (token: string, status: QueueEntry["status"]) => void;
  addVisitor: (v: Omit<Visitor, "id" | "passIssued" | "status">) => Visitor;
  checkOutVisitor: (id: string) => void;
  addAdmission: (a: Omit<Admission, "id">) => Admission;
  addEmergencyCase: (e: Omit<EmergencyCase, "id" | "arrivedAt">) => EmergencyCase;
  sendStaffMessage: (message: { recipient: string; subject: string; body: string; channel: NotificationItem["channel"] }) => void;
  recordAction: (action: { action: Parameters<typeof createBackendReceptionistAction>[0]["action"]; subject: string; detail: string; relatedType?: string; relatedId?: string }) => void;
  generateReport: (input: Parameters<typeof generateBackendReceptionistReport>[0]) => Promise<Record<string, number> | undefined>;
  saveSettings: (input: BackendReceptionistSettings) => void;
  pushNotification: (n: Omit<NotificationItem, "id" | "time">) => void;
}

const ReceptionistDataContext = React.createContext<ReceptionistData | null>(null);

function birthDateFromAge(age: number) {
  if (!Number.isFinite(age) || age <= 0) return undefined;
  const today = new Date();
  return `${today.getFullYear() - Math.floor(age)}-01-01`;
}

function ignoreSyncError(error: unknown) {
  if (error instanceof ApiSyncSkippedError) return;
  console.warn("Receptionist backend sync failed", error);
}

function ReceptionistWorkspaceSkeleton() {
  return (
    <div>
      <SectionSkeleton />
      <Card className="mb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-72 max-w-full" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, cardIndex) => (
          <Card key={cardIndex}>
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-14" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-44 max-w-full" />
                    <Skeleton className="mt-2 h-3 w-56 max-w-full" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ReceptionistDataProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [context, setContext] = React.useState<BackendReceptionistContext>(defaultReceptionistContext);
  const [doctors, setDoctors] = React.useState<ReceptionistDoctor[]>([]);
  const [wards, setWards] = React.useState<string[]>([]);
  const [backendWorkplaceId, setBackendWorkplaceId] = React.useState<string | undefined>();
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [queue, setQueue] = React.useState<QueueEntry[]>([]);
  const [visitors, setVisitors] = React.useState<Visitor[]>([]);
  const [admissions, setAdmissions] = React.useState<Admission[]>([]);
  const [emergencyCases, setEmergencyCases] = React.useState<EmergencyCase[]>([]);
  const [billingRows, setBillingRows] = React.useState<BillingRow[]>([]);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [followUps, setFollowUps] = React.useState<BackendReceptionistFollowUp[]>([]);
  const [tasks, setTasks] = React.useState<BackendReceptionistTask[]>([]);
  const [coordination, setCoordination] = React.useState<BackendReceptionistCoordinationRow[]>([]);
  const [documents, setDocuments] = React.useState<BackendReceptionistDocument[]>([]);
  const [auditTrail, setAuditTrail] = React.useState<BackendReceptionistAuditTrail[]>([]);
  const [settings, setSettings] = React.useState<BackendReceptionistSettings | null>(null);

  function applyBackendSnapshot(data: Awaited<ReturnType<typeof getBackendReceptionistBootstrap>>) {
    setBackendWorkplaceId(data.workplaceId);
    setContext(data.context ?? defaultReceptionistContext);
    setDoctors(data.doctors);
    setWards(data.wards);
    setPatients(data.patients);
    setAppointments(data.appointments);
    setQueue(data.queue);
    setVisitors(data.visitors);
    setAdmissions(data.admissions);
    setEmergencyCases(data.emergencyCases);
    setBillingRows(data.billingRows);
    setNotifications(data.notifications);
    setFollowUps(data.followUps ?? []);
    setTasks(data.tasks ?? []);
    setCoordination(data.coordination ?? []);
    setDocuments(data.documents ?? []);
    setAuditTrail(data.auditTrail ?? []);
    setSettings(data.settings ?? null);
  }

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getBackendReceptionistBootstrap();
        if (cancelled) return;
        applyBackendSnapshot(data);
      } catch (error) {
        ignoreSyncError(error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const nowTime = () =>
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  function findBackendDoctorForDepartment(department: string) {
    return doctors.find((doctor) => doctor.department === department) ?? doctors[0];
  }

  function findDoctorOption(name: string) {
    return doctors.find((doctor) => doctor.name === name);
  }

  const addPatient: ReceptionistData["addPatient"] = async (p) => {
    const doctor = findBackendDoctorForDepartment(p.department);
    const patient: Patient = {
      ...p,
      uhid: generateUHID(patients),
      primaryDoctorId: doctor?.backendId,
      workplaceId: backendWorkplaceId,
    };

    const snapshot = await createBackendReceptionistPatient({
      qlynoId: patient.uhid,
      fullName: patient.name,
      gender: patient.gender,
      dateOfBirth: birthDateFromAge(patient.age),
      phone: patient.phone,
      email: p.email,
      bloodGroup: patient.bloodGroup,
      primaryDoctorId: doctor?.backendId,
      workplaceId: backendWorkplaceId,
      localMrn: patient.uhid,
      department: patient.department,
      address: p.address,
      notes: p.notes,
    });
    applyBackendSnapshot(snapshot);
    const savedPatient =
      snapshot.patients.find((item) => item.uhid === patient.uhid) ??
      snapshot.patients.find((item) => item.name === patient.name && item.phone === patient.phone);
    if (!savedPatient?.backendId) throw new Error("Patient registration was not returned from the backend.");
    pushNotification({
      title: "Patient registered",
      detail: `${savedPatient.name} registered with ${savedPatient.uhid}`,
      channel: "System",
    });
    return savedPatient;
  };

  const addAppointment: ReceptionistData["addAppointment"] = async (a) => {
    const patient = patients.find((item) => item.uhid === a.uhid);
    const doctor = findDoctorOption(a.doctor);
    const patientId = patient?.backendId;
    const doctorId = doctor?.backendId;
    const workplaceId = patient?.workplaceId ?? backendWorkplaceId;
    if (!isUuid(patientId) || !isUuid(doctorId) || !isUuid(workplaceId)) {
      throw new ApiSyncSkippedError("Appointment booking needs a patient and doctor saved in the backend database.");
    }
    const appt: Appointment = {
      ...a,
      date: formatReceptionistDate(a.date),
      id: `APT-${1043 + appointments.length}`,
      patientId,
      doctorId,
      workplaceId,
    };
    const snapshot = await createBackendReceptionistAppointment({
      patientId,
      doctorId,
      workplaceId,
      date: parseReceptionistDate(appt.date),
      time: appt.time,
      durationMins: 20,
      type: "In-Person",
      reason: "Front desk booking",
    });
    applyBackendSnapshot(snapshot);
    pushNotification({
      title: "Appointment booked",
      detail: `${appt.patient} scheduled with ${appt.doctor} on ${appt.date}, ${appt.time}`,
      channel: "SMS",
    });
    return snapshot.appointments.find((item) => item.patientId === patientId && item.doctorId === doctorId) ?? appt;
  };

  const updatePatient: ReceptionistData["updatePatient"] = async (patientId, input) => {
    const patient = patients.find((item) => item.backendId === patientId);
    const snapshot = await updateBackendReceptionistPatient(patientId, {
      ...input,
      workplaceId: input.workplaceId ?? patient?.workplaceId ?? backendWorkplaceId,
    });
    applyBackendSnapshot(snapshot);
  };

  const deactivatePatient: ReceptionistData["deactivatePatient"] = async (patientId, workplaceId) => {
    const patient = patients.find((item) => item.backendId === patientId);
    const snapshot = await deactivateBackendReceptionistPatient(patientId, workplaceId ?? patient?.workplaceId ?? backendWorkplaceId);
    applyBackendSnapshot(snapshot);
  };

  const updateAppointmentStatus: ReceptionistData["updateAppointmentStatus"] = (id, status) => {
    const appointment = appointments.find((item) => item.id === id);
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    const appointmentId = appointment?.backendId;
    if (isUuid(appointmentId)) {
      void updateBackendReceptionistAppointmentStatus(appointmentId, status, appointment?.workplaceId ?? backendWorkplaceId)
        .then(applyBackendSnapshot)
        .catch(ignoreSyncError);
    }
  };

  const checkIn: ReceptionistData["checkIn"] = (q) => {
    const patient = patients.find((item) => item.name === q.patient);
    const doctor = findDoctorOption(q.doctor);
    const matchingAppointment = appointments.find(
      (appointment) =>
        appointment.uhid === patient?.uhid &&
        appointment.doctor === q.doctor &&
        appointment.status !== "Cancelled" &&
        appointment.status !== "Completed"
    );
    const entry: QueueEntry = {
      ...q,
      token: generateToken(queue),
      appointmentId: matchingAppointment?.backendId,
      patientId: patient?.backendId,
      doctorId: doctor?.backendId,
      workplaceId: patient?.workplaceId ?? backendWorkplaceId,
    };
    setQueue((prev) => [entry, ...prev]);
    pushNotification({
      title: "Patient checked in",
      detail: `${entry.patient} issued token ${entry.token} for ${entry.doctor}`,
      channel: "System",
    });
    const patientId = patient?.backendId;
    const doctorId = doctor?.backendId;
    const workplaceId = patient?.workplaceId ?? backendWorkplaceId;
    if (isUuid(patientId) && isUuid(doctorId)) {
      void createBackendReceptionistCheckIn({ patientId, doctorId, workplaceId })
        .then(applyBackendSnapshot)
        .catch(ignoreSyncError);
    }
    return entry;
  };

  const advanceQueueStatus: ReceptionistData["advanceQueueStatus"] = (token, status) => {
    const entry = queue.find((item) => item.token === token);
    setQueue((prev) => prev.map((q) => (q.token === token ? { ...q, status } : q)));
    const appointmentId = entry?.appointmentId;
    if (isUuid(appointmentId)) {
      void updateBackendReceptionistAppointmentStatus(appointmentId, status, entry?.workplaceId ?? backendWorkplaceId)
        .then(applyBackendSnapshot)
        .catch(ignoreSyncError);
    }
  };

  const addVisitor: ReceptionistData["addVisitor"] = (v) => {
    const visitor: Visitor = {
      ...v,
      id: `VIS-${3302 + visitors.length}`,
      passIssued: nowTime(),
      status: "Checked In",
    };
    setVisitors((prev) => [visitor, ...prev]);
    const admission = admissions.find((item) => item.patient === v.visiting && item.ward === v.ward);
    const patient = patients.find((item) => item.name === v.visiting);
    const patientId = admission?.patientId ?? patient?.backendId;
    const workplaceId = admission?.workplaceId ?? patient?.workplaceId ?? backendWorkplaceId;
    if (isUuid(patientId)) {
      void createBackendReceptionistVisitor({
        patientId,
        workplaceId,
        name: v.name,
        relation: v.relation,
        ward: v.ward,
      })
        .then(applyBackendSnapshot)
        .catch(ignoreSyncError);
    }
    return visitor;
  };

  const checkOutVisitor: ReceptionistData["checkOutVisitor"] = (id) => {
    setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Checked Out" } : v)));
    void checkOutBackendReceptionistVisitor(id, backendWorkplaceId)
      .then(applyBackendSnapshot)
      .catch(ignoreSyncError);
  };

  const addAdmission: ReceptionistData["addAdmission"] = (a) => {
    const admission: Admission = { ...a, id: `IPD-${2232 + admissions.length}` };
    setAdmissions((prev) => [admission, ...prev]);
    pushNotification({
      title: "Patient admitted",
      detail: `${admission.patient} admitted to ${admission.ward} (${admission.bed})`,
      channel: "System",
    });
    const patient = patients.find((item) => item.uhid === a.uhid);
    const doctor = findDoctorOption(a.doctor);
    const patientId = patient?.backendId;
    const doctorId = doctor?.backendId;
    const workplaceId = patient?.workplaceId ?? backendWorkplaceId;
    if (isUuid(patientId) && isUuid(doctorId)) {
      void createBackendReceptionistAdmission({
        patientId,
        doctorId,
        workplaceId,
        ward: a.ward,
        bed: a.bed,
        admittedAt: parseReceptionistDate(a.admittedOn),
      })
        .then(applyBackendSnapshot)
        .catch(ignoreSyncError);
    }
    return admission;
  };

  const addEmergencyCase: ReceptionistData["addEmergencyCase"] = (e) => {
    const emergencyCase: EmergencyCase = {
      ...e,
      id: `ER-${901 + emergencyCases.length}`,
      arrivedAt: nowTime(),
    };
    setEmergencyCases((prev) => [emergencyCase, ...prev]);
    pushNotification({
      title: "Emergency registration",
      detail: `${emergencyCase.name} registered as ${emergencyCase.severity} - routed to ${emergencyCase.doctor}`,
      channel: "System",
    });
    const doctor = findDoctorOption(e.doctor);
    if (isUuid(doctor?.backendId)) {
      void createBackendReceptionistEmergencyCase({
        name: e.name,
        age: e.age === "Unknown" ? undefined : e.age,
        severity: e.severity,
        doctorId: doctor.backendId,
        workplaceId: backendWorkplaceId,
        complaint: e.name,
      })
        .then(applyBackendSnapshot)
        .catch(ignoreSyncError);
    }
    return emergencyCase;
  };

  const pushNotification: ReceptionistData["pushNotification"] = (n) => {
    setNotifications((prev) => [
      { ...n, id: `N-${prev.length + 1}`, time: "Just now" },
      ...prev,
    ]);
  };

  const sendStaffMessage: ReceptionistData["sendStaffMessage"] = (message) => {
    pushNotification({
      title: message.subject,
      detail: message.body,
      channel: message.channel,
      recipient: message.recipient,
    });
    void createBackendReceptionistNotification({
      ...message,
      workplaceId: backendWorkplaceId,
    })
      .then(applyBackendSnapshot)
      .catch(ignoreSyncError);
  };

  const recordAction: ReceptionistData["recordAction"] = (action) => {
    pushNotification({
      title: action.subject,
      detail: action.detail,
      channel: "System",
    });
    void createBackendReceptionistAction({
      ...action,
      workplaceId: backendWorkplaceId,
    })
      .then(applyBackendSnapshot)
      .catch(ignoreSyncError);
  };

  const generateReport: ReceptionistData["generateReport"] = async (input) => {
    try {
      const payload = await generateBackendReceptionistReport({
        ...input,
        workplaceId: backendWorkplaceId,
      });
      applyBackendSnapshot(payload.data);
      return payload.report;
    } catch (error) {
      ignoreSyncError(error);
      return undefined;
    }
  };

  const saveSettings: ReceptionistData["saveSettings"] = (input) => {
    const nextSettings = { ...(settings ?? {}), ...input };
    setSettings(nextSettings);
    void saveBackendReceptionistSettings({
      ...input,
      workplaceId: backendWorkplaceId,
    })
      .then(applyBackendSnapshot)
      .catch(ignoreSyncError);
  };

  const value: ReceptionistData = {
    context,
    doctors,
    wards,
    patients,
    appointments,
    queue,
    visitors,
    admissions,
    emergencyCases,
    billingRows,
    notifications,
    followUps,
    tasks,
    coordination,
    documents,
    auditTrail,
    settings,
    addPatient,
    updatePatient,
    deactivatePatient,
    addAppointment,
    updateAppointmentStatus,
    checkIn,
    advanceQueueStatus,
    addVisitor,
    checkOutVisitor,
    addAdmission,
    addEmergencyCase,
    sendStaffMessage,
    recordAction,
    generateReport,
    saveSettings,
    pushNotification,
  };

  if (isLoading) return <ReceptionistWorkspaceSkeleton />;

  return (
    <ReceptionistDataContext.Provider value={value}>
      {children}
    </ReceptionistDataContext.Provider>
  );
}

export function useReceptionistData() {
  const ctx = React.useContext(ReceptionistDataContext);
  if (!ctx) {
    throw new Error("useReceptionistData must be used within ReceptionistDataProvider");
  }
  return ctx;
}
