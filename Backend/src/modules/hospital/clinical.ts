import { Router } from "express";
import { z } from "zod";
import { endpoint, scope, list, uuid, text, note, date, id, patient, doctor, encounter, conflict, interval, transition } from "./common";
import { notFound } from "../../utils/errors";

export const appointmentTransitions: Record<string, readonly string[]> = {
  SCHEDULED: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"], CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["WAITING", "IN_CONSULTATION", "CANCELLED"], WAITING: ["IN_CONSULTATION", "CANCELLED"], IN_CONSULTATION: ["COMPLETED"],
};
const clinicalScope = scope.extend({ patientId: uuid, doctorId: uuid, encounterId: uuid.optional() });
const medicine = z.object({ medicineName: text, strength: text.optional(), dose: text, frequency: text, duration: text, route: text.optional(), quantity: z.number().int().positive().max(10000), instructions: text.optional() }).strict();
export const prescriptionInput = clinicalScope.extend({ advice: note.optional(), medicines: z.array(medicine).min(1).max(50) });

export function clinical(router: Router) {
  endpoint(router, "get", "/appointments", "hms.appointments.read", list.extend({ patientId: uuid.optional(), doctorId: uuid.optional(), from: date.optional(), to: date.optional() }), async (input, { db }) => db.appointments.findMany({ where: { workplaceId: input.workplaceId, patientId: input.patientId, doctorId: input.doctorId, scheduledAt: { gte: input.from, lte: input.to } }, include: { patients: true, doctor_profiles: true }, orderBy: { scheduledAt: "asc" }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/appointments", "hms.appointments.write", scope.extend({ patientId: uuid, doctorId: uuid, locationId: uuid.optional(), scheduledAt: date, durationMinutes: z.number().int().min(5).max(480).default(20), mode: z.enum(["IN_PERSON", "VIDEO", "HOME", "HOSPITAL"]).default("IN_PERSON"), reason: text.optional() }), async (input, { db }) => {
    await patient(db, input.patientId, input.workplaceId); await doctor(db, input.doctorId, input.workplaceId);
    if (input.locationId && !await db.workplace_locations.findFirst({ where: { id: input.locationId, workplaceId: input.workplaceId } })) throw notFound("Location");
    const end = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60000);
    const shifts = await db.doctor_shifts.findMany({ where: { doctorId: input.doctorId, workplaceId: input.workplaceId, bookingEnabled: true, status: { in: ["UPCOMING", "ACTIVE"] }, startsAt: { lte: input.scheduledAt }, endsAt: { gte: end } } });
    if (!shifts.length) throw conflict("Appointment must fit an available doctor shift", "NO_AVAILABILITY");
    // Include appointments at every workplace: one doctor cannot be booked twice.
    const others = await db.appointments.findMany({ where: { doctorId: input.doctorId, status: { notIn: ["CANCELLED", "NO_SHOW", "RESCHEDULED"] }, scheduledAt: { lt: end, gt: new Date(input.scheduledAt.getTime() - 480 * 60000) } } });
    if (others.some(row => row.scheduledAt.getTime() + row.durationMinutes * 60000 > input.scheduledAt.getTime())) throw conflict("Doctor is already booked", "SLOT_CONFLICT");
    return db.appointments.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "patch", "/appointments/:id/status", "hms.appointments.write", scope.extend({ status: z.enum(["CONFIRMED", "CHECKED_IN", "WAITING", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"]), reason: text.optional() }), async (input, { db, params, context }) => {
    const row = await db.appointments.findFirst({ where: { id: params.id, workplaceId: input.workplaceId } }); if (!row) throw notFound("Appointment");
    if (["IN_CONSULTATION", "COMPLETED"].includes(input.status)) await doctor(db, row.doctorId, input.workplaceId, context);
    transition(row.status, input.status, appointmentTransitions);
    return db.appointments.update({ where: { id: row.id }, data: { status: input.status, updatedAt: new Date(), ...(input.status === "CHECKED_IN" ? { checkedInAt: new Date() } : {}), ...(input.status === "CANCELLED" ? { cancelledAt: new Date(), cancellationReason: input.reason } : {}), ...(input.status === "COMPLETED" ? { completedAt: new Date() } : {}) } });
  });
  endpoint(router, "get", "/shifts", "hms.appointments.read", list.extend({ doctorId: uuid.optional() }), async (input, { db }) => db.doctor_shifts.findMany({ where: { workplaceId: input.workplaceId, doctorId: input.doctorId }, take: input.take, skip: input.skip, orderBy: { startsAt: "asc" } }));
  endpoint(router, "post", "/shifts", "hms.appointments.write", scope.extend({ doctorId: uuid, startsAt: date, endsAt: date, shiftType: z.enum(["CLINIC_OPD", "HOSPITAL_DUTY", "WARD_ROUND", "ON_CALL", "ONLINE_CONSULTATION", "BLOCKED", "LEAVE"]), bookingEnabled: z.boolean().default(true), slotMinutes: z.number().int().min(5).max(120).default(20) }), async (input, { db, context }) => {
    interval(input.startsAt, input.endsAt); await doctor(db, input.doctorId, input.workplaceId, context.roles.includes("hospital_doctor") ? context : undefined);
    if (await db.doctor_shifts.findFirst({ where: { doctorId: input.doctorId, status: { not: "CANCELLED" }, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } } })) throw conflict("Shift overlaps another shift", "SLOT_CONFLICT");
    return db.doctor_shifts.create({ data: { ...input, id: id(), updatedAt: new Date(), bookingEnabled: ["BLOCKED", "LEAVE"].includes(input.shiftType) ? false : input.bookingEnabled } });
  });
  endpoint(router, "get", "/encounters", "hms.clinical.read", list.extend({ patientId: uuid.optional() }), async (input, { db }) => db.encounters.findMany({ where: { workplaceId: input.workplaceId, patientId: input.patientId }, take: input.take, skip: input.skip, orderBy: { createdAt: "desc" } }));
  endpoint(router, "post", "/encounters", "hms.clinical.write", clinicalScope.omit({ encounterId: true }).extend({ appointmentId: uuid.optional(), type: z.enum(["NEW_CONSULTATION", "FOLLOW_UP", "TELECONSULTATION", "PROCEDURE_REVIEW", "INPATIENT_ROUND", "EMERGENCY"]), chiefComplaint: note }), async (input, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); await doctor(db, input.doctorId, input.workplaceId, context);
    if (input.appointmentId) {
      const appointment = await db.appointments.findFirst({ where: { id: input.appointmentId, workplaceId: input.workplaceId, patientId: input.patientId, doctorId: input.doctorId, status: { in: ["CHECKED_IN", "WAITING", "IN_CONSULTATION"] } } });
      if (!appointment) throw conflict("Appointment must be checked in and match the encounter");
      if (await db.encounters.findFirst({ where: { appointmentId: appointment.id } })) throw conflict("Appointment already has an encounter");
      await db.appointments.update({ where: { id: appointment.id }, data: { status: "IN_CONSULTATION", startedAt: new Date(), updatedAt: new Date() } });
    }
    return db.encounters.create({ data: { ...input, id: id(), status: "CONSULTATION_STARTED", startedAt: new Date(), updatedAt: new Date() } });
  });
  endpoint(router, "get", "/encounters/:id", "hms.clinical.read", scope, async (input, { db, params }) => {
    const row = await db.encounters.findFirst({ where: { id: params.id, workplaceId: input.workplaceId }, include: { diagnoses: true, vital_sets: true, prescriptions: { include: { prescription_medications: true } }, investigation_orders: { include: { reports: true } }, follow_ups: true } });
    if (!row) throw notFound("Encounter"); return row;
  });
  endpoint(router, "patch", "/encounters/:id", "hms.clinical.write", scope.extend({ history: note.optional(), examination: note.optional(), clinicalNotes: note.optional(), assessment: note.optional(), treatmentPlan: note.optional(), advice: note.optional(), complete: z.boolean().default(false) }), async ({ workplaceId, complete, ...input }, { db, params, context }) => {
    const row = await db.encounters.findFirst({ where: { id: params.id, workplaceId } }); if (!row) throw notFound("Encounter");
    await doctor(db, row.doctorId, workplaceId, context);
    if (["CONSULTATION_COMPLETED", "CLOSED", "CANCELLED"].includes(row.status)) throw conflict("Completed clinical records cannot be overwritten");
    if (complete && !(input.assessment ?? row.assessment)) throw conflict("Assessment is required before completion");
    if (complete && row.appointmentId) await db.appointments.update({ where: { id: row.appointmentId }, data: { status: "COMPLETED", completedAt: new Date(), updatedAt: new Date() } });
    return db.encounters.update({ where: { id: row.id }, data: { ...input, updatedAt: new Date(), ...(complete ? { status: "CONSULTATION_COMPLETED", completedAt: new Date() } : {}) } });
  });
  endpoint(router, "get", "/prescriptions", "hms.clinical.read", list.extend({ patientId: uuid.optional() }), async (input, { db }) => db.prescriptions.findMany({ where: { workplaceId: input.workplaceId, patientId: input.patientId }, include: { prescription_medications: true }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/prescriptions", "hms.clinical.write", prescriptionInput, async ({ medicines, ...input }, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); await doctor(db, input.doctorId, input.workplaceId, context);
    if (input.encounterId) { const visit = await encounter(db, input.encounterId, input.patientId, input.workplaceId); if (visit.doctorId !== input.doctorId) throw conflict("Encounter doctor does not match"); }
    return db.prescriptions.create({ data: { ...input, id: id(), status: "ACTIVE", issuedAt: new Date(), updatedAt: new Date(), prescription_medications: { create: medicines.map((item, index) => ({ ...item, quantity: String(item.quantity), id: id(), sortOrder: index, updatedAt: new Date() })) } }, include: { prescription_medications: true } });
  });
  endpoint(router, "get", "/diagnoses", "hms.clinical.read", list.extend({ patientId: uuid }), async (input, { db }) => {
    await patient(db, input.patientId, input.workplaceId);
    return db.diagnoses.findMany({ where: { patientId: input.patientId, encounters: { workplaceId: input.workplaceId } }, take: input.take, skip: input.skip });
  });
  endpoint(router, "post", "/diagnoses", "hms.clinical.write", scope.extend({ patientId: uuid, encounterId: uuid, description: text, icdCode: z.string().max(25).optional(), type: z.enum(["PRIMARY", "SECONDARY", "PROVISIONAL", "CONFIRMED"]).default("PRIMARY"), status: z.enum(["ACTIVE", "RESOLVED", "CHRONIC", "RULED_OUT"]).default("ACTIVE") }), async ({ workplaceId, ...input }, { db, context }) => {
    const visit = await encounter(db, input.encounterId, input.patientId, workplaceId); await doctor(db, visit.doctorId, workplaceId, context);
    return db.diagnoses.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "get", "/vitals", "hms.clinical.read", list.extend({ patientId: uuid }), async (input, { db }) => {
    await patient(db, input.patientId, input.workplaceId);
    return db.vital_sets.findMany({ where: { patientId: input.patientId, encounters: { workplaceId: input.workplaceId } }, take: input.take, skip: input.skip, orderBy: { recordedAt: "desc" } });
  });
  const vitals = scope.extend({ patientId: uuid, encounterId: uuid, systolicBp: z.number().int().min(1).max(350).optional(), diastolicBp: z.number().int().min(1).max(250).optional(), pulse: z.number().int().min(0).max(350).optional(), temperatureF: z.number().min(70).max(120).optional(), spo2: z.number().int().min(0).max(100).optional(), weightKg: z.number().positive().max(700).optional(), heightCm: z.number().positive().max(280).optional(), respiratoryRate: z.number().int().min(0).max(150).optional(), notes: note.optional() });
  endpoint(router, "post", "/vitals", "hms.vitals.write", vitals, async ({ workplaceId, ...input }, { db, context }) => {
    const visit = await encounter(db, input.encounterId, input.patientId, workplaceId);
    if (["CLOSED", "CANCELLED"].includes(visit.status)) throw conflict("Encounter is closed");
    if (context.roles.includes("hospital_doctor")) await doctor(db, visit.doctorId, workplaceId, context);
    return db.vital_sets.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "get", "/investigations", "hms.clinical.read", list.extend({ patientId: uuid.optional() }), async (input, { db }) => db.investigation_orders.findMany({ where: { workplaceId: input.workplaceId, patientId: input.patientId }, include: { reports: true }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/investigations", "hms.clinical.write", clinicalScope.extend({ title: text, type: z.enum(["LABORATORY", "RADIOLOGY", "EXTERNAL_REPORT"]), priority: z.enum(["ROUTINE", "URGENT", "CRITICAL"]).default("ROUTINE"), doctorNotes: note.optional() }), async (input, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); await doctor(db, input.doctorId, input.workplaceId, context);
    if (input.encounterId) { const visit = await encounter(db, input.encounterId, input.patientId, input.workplaceId); if (visit.doctorId !== input.doctorId) throw conflict("Encounter doctor does not match"); }
    return db.investigation_orders.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "get", "/follow-ups", "hms.clinical.read", list, async (input, { db }) => db.follow_ups.findMany({ where: { workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { dueAt: "asc" } }));
  endpoint(router, "post", "/follow-ups", "hms.clinical.write", clinicalScope.extend({ reason: text, dueAt: date }), async (input, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); await doctor(db, input.doctorId, input.workplaceId, context);
    if (input.encounterId) await encounter(db, input.encounterId, input.patientId, input.workplaceId);
    return db.follow_ups.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "patch", "/follow-ups/:id/status", "hms.clinical.write", scope.extend({ status: z.enum(["COMPLETED", "CANCELLED"]) }), async (input, { db, context, params }) => {
    const row = await db.follow_ups.findFirst({ where: { id: params.id, workplaceId: input.workplaceId } }); if (!row) throw notFound("Follow-up");
    await doctor(db, row.doctorId, row.workplaceId, context);
    if (["COMPLETED", "CANCELLED"].includes(row.status)) throw conflict("Follow-up is already closed");
    return db.follow_ups.update({ where: { id: row.id }, data: { status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : undefined, updatedAt: new Date() } });
  });
}
