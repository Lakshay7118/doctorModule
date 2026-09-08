import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma";
import { endpoint, scope, list, uuid, text, note, date, id, patient, conflict, transition } from "./common";
import { notFound } from "../../utils/errors";

const ambulanceStatuses = ["AVAILABLE", "DISPATCHED", "EN_ROUTE", "AT_SCENE", "TRANSPORTING", "AT_HOSPITAL", "MAINTENANCE_OFFLINE"] as const;
const activeTripStatuses = ["DISPATCHED", "EN_ROUTE", "RE_ROUTED", "AT_SCENE", "PATIENT_PICKED_UP", "TRANSPORTING", "AT_HOSPITAL"] as const;
export const ambulanceTripTransitions: Record<string, readonly string[]> = {
  DISPATCHED: ["EN_ROUTE", "AT_SCENE", "PATIENT_PICKED_UP", "CANCELLED"],
  EN_ROUTE: ["RE_ROUTED", "AT_SCENE", "CANCELLED"],
  RE_ROUTED: ["EN_ROUTE", "AT_SCENE", "PATIENT_PICKED_UP", "TRANSPORTING", "AT_HOSPITAL", "CANCELLED"],
  AT_SCENE: ["PATIENT_PICKED_UP", "TRANSPORTING", "CANCELLED"],
  PATIENT_PICKED_UP: ["TRANSPORTING", "AT_HOSPITAL", "COMPLETED"],
  TRANSPORTING: ["AT_HOSPITAL", "COMPLETED"],
  AT_HOSPITAL: ["COMPLETED"],
};

const crewMember = z.object({
  name: text,
  role: z.enum(["PARAMEDIC", "EMT", "EMERGENCY_NURSE", "TRIAGE_SPECIALIST"]),
  phone: z.string().min(7).max(30),
}).strict();
const telemetry = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmH: z.number().min(0).max(240).default(0),
  heading: z.string().trim().min(1).max(40).default("STATIONARY"),
  isGpsOnline: z.boolean().default(true),
  lastPing: z.string().trim().min(1).max(80).default("Just now"),
}).strict();
const ambulanceRegistryInput = scope.extend({
  registrationNumber: text,
  type: z.enum(["ALS", "BLS", "NEONATAL_ICU", "PATIENT_TRANSPORT", "BASIC", "ADVANCED"]),
  driverName: text.default("Unassigned"),
  driverPhone: z.string().min(7).max(30).default("+910000000000"),
  driverLicense: text.optional(),
  driverShift: text.optional(),
  equipment: z.array(text).max(50).default([]),
  baseLocation: text.default("Main ambulance bay"),
  crew: z.array(crewMember).max(8).default([]),
  telemetry: telemetry.optional(),
  maintenanceNotes: note.optional(),
});
const ambulanceTripInput = scope.extend({
  patientId: uuid.optional(),
  emergencyCaseId: uuid.optional(),
  ambulanceId: uuid,
  pickup: text.optional(),
  originAddress: text.optional(),
  destination: text.optional(),
  destinationHospital: text.optional(),
  patientName: text.optional(),
  isPatientLinked: z.boolean().default(true),
  priority: z.enum(["CRITICAL", "URGENT", "STANDARD"]).default("URGENT"),
  notes: note.optional(),
}).superRefine((value, ctx) => {
  if (!value.pickup && !value.originAddress) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pickup"], message: "Pickup or originAddress is required" });
  if (!value.destination && !value.destinationHospital) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination"], message: "Destination or destinationHospital is required" });
  if (!value.isPatientLinked && value.patientId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["patientId"], message: "Anonymous dispatch cannot include patientId" });
});
function ambulanceStatusForTrip(status: string) {
  if (status === "COMPLETED" || status === "CANCELLED") return "AVAILABLE";
  if (status === "PATIENT_PICKED_UP") return "TRANSPORTING";
  if (status === "RE_ROUTED") return "EN_ROUTE";
  return status;
}
function eventHistory(row: { rerouteHistory: Prisma.JsonValue }) {
  return Array.isArray(row.rerouteHistory) ? row.rerouteHistory : [];
}

export function operations(router: Router) {
  endpoint(router, "get", "/visitors", "hms.care.read", list, async (input, { db, context }) => db.hospitalVisitor.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { checkedInAt: "desc" } }));
  endpoint(router, "post", "/visitors", "hms.visitors.write", scope.extend({ patientId: uuid, name: text, phone: z.string().min(7).max(30), purpose: text }), async (input, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); return db.hospitalVisitor.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "post", "/visitors/:id/check-out", "hms.visitors.write", scope, async (input, { db, context, params }) => {
    const row = await db.hospitalVisitor.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Visitor");
    if (row.checkedOutAt) return row; return db.hospitalVisitor.update({ where: { id: row.id }, data: { checkedOutAt: new Date() } });
  });
  endpoint(router, "get", "/ambulances", "hms.care.read", list, async (input, { db, context }) => db.hospitalAmbulance.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { registrationNumber: "asc" } }));
  endpoint(router, "post", "/ambulances", "hms.operations.write", ambulanceRegistryInput, async (input, { db, context }) => db.hospitalAmbulance.create({ data: { ...input, tenantId: context.tenantId, crew: input.crew, telemetry: input.telemetry ?? Prisma.JsonNull } }));
  endpoint(router, "patch", "/ambulances/:id", "hms.operations.write", scope.extend({ registrationNumber: text.optional(), type: z.enum(["ALS", "BLS", "NEONATAL_ICU", "PATIENT_TRANSPORT", "BASIC", "ADVANCED"]).optional(), driverName: text.optional(), driverPhone: z.string().min(7).max(30).optional(), driverLicense: text.optional(), driverShift: text.optional(), equipment: z.array(text).max(50).optional(), baseLocation: text.optional(), crew: z.array(crewMember).max(8).optional(), telemetry: telemetry.optional(), maintenanceNotes: note.optional() }), async ({ workplaceId, ...input }, { db, context, params }) => {
    const row = await db.hospitalAmbulance.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId } }); if (!row) throw notFound("Ambulance");
    return db.hospitalAmbulance.update({ where: { id: row.id }, data: input });
  });
  endpoint(router, "patch", "/ambulances/:id/status", "hms.operations.write", scope.extend({ status: z.enum(ambulanceStatuses), maintenanceNotes: note.optional() }), async (input, { db, context, params }) => {
    const row = await db.hospitalAmbulance.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Ambulance");
    if (input.status === "AVAILABLE" && await db.ambulanceTrip.findFirst({ where: { ambulanceId: row.id, status: { in: [...activeTripStatuses] } } })) throw conflict("Ambulance still has an active dispatch", "ACTIVE_DISPATCH");
    if (input.status === "MAINTENANCE_OFFLINE" && !input.maintenanceNotes) throw conflict("Maintenance notes are required");
    return db.hospitalAmbulance.update({ where: { id: row.id }, data: { status: input.status, maintenanceNotes: input.maintenanceNotes } });
  });
  endpoint(router, "get", "/ambulance-trips", "hms.care.read", list, async (input, { db, context }) => db.ambulanceTrip.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, include: { ambulance: true, emergencyCase: true }, take: input.take, skip: input.skip, orderBy: { dispatchedAt: "desc" } }));
  endpoint(router, "post", "/ambulance-trips", "hms.operations.write", ambulanceTripInput, async (input, { db, context }) => {
    let patientId = input.patientId;
    if (patientId) await patient(db, patientId, input.workplaceId);
    if (input.emergencyCaseId) {
      const emergency = await db.emergencyCase.findFirst({ where: { id: input.emergencyCaseId, tenantId: context.tenantId, workplaceId: input.workplaceId, status: { notIn: ["DISCHARGED", "TRANSFERRED"] } } });
      if (!emergency) throw notFound("Emergency case");
      if (patientId && patientId !== emergency.patientId) throw conflict("Emergency case patient does not match dispatch patient");
      patientId = input.isPatientLinked ? emergency.patientId : undefined;
    }
    const allocated = await db.hospitalAmbulance.updateMany({ where: { id: input.ambulanceId, tenantId: context.tenantId, workplaceId: input.workplaceId, status: "AVAILABLE" }, data: { status: "DISPATCHED" } });
    if (allocated.count !== 1) throw conflict("Ambulance is unavailable");
    const pickup = input.pickup ?? input.originAddress!;
    const destination = input.destination ?? input.destinationHospital!;
    const trip = await db.ambulanceTrip.create({ data: { tenantId: context.tenantId, workplaceId: input.workplaceId, ambulanceId: input.ambulanceId, emergencyCaseId: input.emergencyCaseId, patientId, pickup, destination, patientName: input.isPatientLinked ? input.patientName : undefined, isPatientLinked: input.isPatientLinked, priority: input.priority, notes: input.notes } });
    const ambulance = await db.hospitalAmbulance.findUniqueOrThrow({ where: { id: input.ambulanceId } });
    await db.hospitalOutbox.createMany({ data: [
      { tenantId: context.tenantId, workplaceId: input.workplaceId, channel: "SMS", recipient: ambulance.driverPhone, subject: "Ambulance dispatch", body: `${ambulance.registrationNumber} dispatched to ${pickup} for ${destination}. Priority: ${input.priority}.` },
      { tenantId: context.tenantId, workplaceId: input.workplaceId, channel: "EMAIL", recipient: "emergency-triage@qlyno.local", subject: "Ambulance dispatch created", body: `Dispatch ${trip.id} assigned to ${ambulance.registrationNumber}.` },
    ] });
    return trip;
  });
  endpoint(router, "patch", "/ambulance-trips/:id/status", "hms.operations.write", scope.extend({ status: z.enum(["EN_ROUTE", "RE_ROUTED", "AT_SCENE", "PATIENT_PICKED_UP", "TRANSPORTING", "AT_HOSPITAL", "COMPLETED", "CANCELLED"]), reason: note.optional() }), async (input, { db, context, params }) => {
    const row = await db.ambulanceTrip.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Trip");
    transition(row.status, input.status, ambulanceTripTransitions);
    const done = ["COMPLETED", "CANCELLED"].includes(input.status);
    if (input.status === "CANCELLED" && !input.reason) throw conflict("Cancellation reason is required");
    await db.hospitalAmbulance.update({ where: { id: row.ambulanceId }, data: { status: ambulanceStatusForTrip(input.status) } });
    return db.ambulanceTrip.update({ where: { id: row.id }, data: { status: input.status, atSceneAt: input.status === "AT_SCENE" ? new Date() : undefined, arrivedHospitalAt: input.status === "AT_HOSPITAL" ? new Date() : undefined, completedAt: input.status === "COMPLETED" ? new Date() : undefined, cancelledAt: input.status === "CANCELLED" ? new Date() : undefined, cancelledReason: input.status === "CANCELLED" ? input.reason : undefined } });
  });
  endpoint(router, "post", "/ambulance-trips/:id/reroute", "hms.operations.write", scope.extend({ destination: text, reason: note }), async (input, { db, context, params }) => {
    const row = await db.ambulanceTrip.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Trip");
    if (!activeTripStatuses.includes(row.status as typeof activeTripStatuses[number])) throw conflict("Only active dispatches can be rerouted");
    const history = [...eventHistory(row), { fromHospital: row.destination, toHospital: input.destination, reason: input.reason, timestamp: new Date().toISOString(), triggeredBy: context.userId }];
    await db.hospitalAmbulance.update({ where: { id: row.ambulanceId }, data: { status: "EN_ROUTE" } });
    return db.ambulanceTrip.update({ where: { id: row.id }, data: { destination: input.destination, status: "RE_ROUTED", rerouteHistory: history } });
  });
  endpoint(router, "post", "/ambulance-trips/:id/reassign", "hms.operations.write", scope.extend({ newAmbulanceId: uuid, reason: note }), async (input, { db, context, params }) => {
    const row = await db.ambulanceTrip.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Trip");
    if (!activeTripStatuses.includes(row.status as typeof activeTripStatuses[number])) throw conflict("Only active dispatches can be reassigned");
    if (row.ambulanceId === input.newAmbulanceId) throw conflict("New ambulance must be different");
    const allocated = await db.hospitalAmbulance.updateMany({ where: { id: input.newAmbulanceId, tenantId: context.tenantId, workplaceId: input.workplaceId, status: "AVAILABLE" }, data: { status: ambulanceStatusForTrip(row.status) } });
    if (allocated.count !== 1) throw conflict("Replacement ambulance is unavailable");
    await db.hospitalAmbulance.update({ where: { id: row.ambulanceId }, data: { status: "MAINTENANCE_OFFLINE", maintenanceNotes: `Dispatch reassigned: ${input.reason}` } });
    const history = [...eventHistory(row), { fromAmbulanceId: row.ambulanceId, toAmbulanceId: input.newAmbulanceId, reason: input.reason, timestamp: new Date().toISOString(), triggeredBy: context.userId }];
    return db.ambulanceTrip.update({ where: { id: row.id }, data: { ambulanceId: input.newAmbulanceId, reassignedFromAmbulanceId: row.ambulanceId, rerouteHistory: history, notes: row.notes ? `${row.notes}\nReassigned: ${input.reason}` : `Reassigned: ${input.reason}` } });
  });
  endpoint(router, "get", "/documents", "hms.read", list, async (input, { db, context }) => db.hospitalDocument.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId, patientId: null }, take: input.take, skip: input.skip }));
  endpoint(router, "get", "/patients/:id/documents", "hms.clinical.read", list, async (input, { db, context, params }) => {
    await patient(db, params.id!, input.workplaceId); return db.hospitalDocument.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId, patientId: params.id }, take: input.take, skip: input.skip });
  });
  endpoint(router, "post", "/documents", "hms.documents.write", scope.extend({ patientId: uuid.optional(), title: text, category: z.enum(["LICENSE", "CERTIFICATE", "CONTRACT", "POLICY", "PATIENT", "STAFF"]), storageKey: z.string().min(1).max(500).regex(/^[A-Za-z0-9_/-]+\.[A-Za-z0-9]+$/), mimeType: text, expiresAt: date.optional() }), async (input, { db, context }) => {
    if (input.patientId) await patient(db, input.patientId, input.workplaceId);
    if (!input.storageKey.startsWith(`${context.tenantId}/${input.workplaceId}/`)) throw conflict("Storage key must be under the tenant/workplace prefix");
    return db.hospitalDocument.create({ data: { ...input, tenantId: context.tenantId, uploadedBy: context.userId } });
  });
  endpoint(router, "get", "/incidents", "hms.care.read", list, async (input, { db, context }) => db.hospitalIncident.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/incidents", "hms.operations.write", scope.extend({ title: text, description: note, severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]) }), async (input, { db, context }) => db.hospitalIncident.create({ data: { ...input, tenantId: context.tenantId, reportedBy: context.userId } }));
  endpoint(router, "patch", "/incidents/:id", "hms.operations.write", scope.extend({ status: z.enum(["INVESTIGATING", "RESOLVED"]), resolution: note.optional() }), async (input, { db, context, params }) => {
    const row = await db.hospitalIncident.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Incident");
    transition(row.status, input.status, { OPEN: ["INVESTIGATING"], INVESTIGATING: ["RESOLVED"] });
    if (input.status === "RESOLVED" && !input.resolution) throw conflict("Resolution is required");
    return db.hospitalIncident.update({ where: { id: row.id }, data: { status: input.status, resolution: input.resolution } });
  });
  endpoint(router, "get", "/tasks", "hms.care.read", list, async (input, { db }) => db.tasks.findMany({ where: { workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { dueAt: "asc" } }));
  endpoint(router, "post", "/tasks", "hms.operations.write", scope.extend({ title: text, description: note.optional(), patientId: uuid.optional(), dueAt: date.optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM") }), async (input, { db }) => {
    if (input.patientId) await patient(db, input.patientId, input.workplaceId);
    return db.tasks.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "patch", "/tasks/:id/status", "hms.operations.write", scope.extend({ status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]) }), async (input, { db, params }) => {
    const row = await db.tasks.findFirst({ where: { id: params.id, workplaceId: input.workplaceId } }); if (!row) throw notFound("Task");
    transition(row.status, input.status, { OPEN: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"] });
    return db.tasks.update({ where: { id: row.id }, data: { status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : undefined, updatedAt: new Date() } });
  });
  endpoint(router, "post", "/communications", "hms.communication.write", scope.extend({ channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]), recipient: z.string().min(3).max(254), subject: text, body: note }), async (input, { db, context }) => db.hospitalOutbox.create({ data: { ...input, tenantId: context.tenantId } }));
  endpoint(router, "get", "/communications", "hms.communication.write", list, async (input, { db, context }) => db.hospitalOutbox.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { createdAt: "desc" } }));
  endpoint(router, "get", "/dashboard", "hms.admin", scope, async (input, { db, context }) => {
    const where = { workplaceId: input.workplaceId };
    const [patients, appointments, beds, admissions, incidents, invoices] = await Promise.all([
      db.patient_workplaces.count({ where: { ...where, status: "ACTIVE" } }), db.appointments.groupBy({ by: ["status"], where, _count: true }),
      db.hospitalBed.groupBy({ by: ["status"], where: { ...where, tenantId: context.tenantId }, _count: true }),
      db.hospitalAdmission.count({ where: { ...where, tenantId: context.tenantId, status: "ADMITTED" } }),
      db.hospitalIncident.count({ where: { ...where, tenantId: context.tenantId, status: { not: "RESOLVED" } } }),
      db.billing_invoices.groupBy({ by: ["status"], where, _sum: { total: true } }),
    ]); return { patients, appointments, beds, admissions, incidents, invoices };
  });
}
