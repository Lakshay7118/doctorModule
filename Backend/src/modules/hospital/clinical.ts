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
const consultationDiagnosis = z.object({ description: text, icdCode: z.string().max(25).optional(), type: z.enum(["PRIMARY", "SECONDARY", "PROVISIONAL", "CONFIRMED"]).default("PRIMARY"), status: z.enum(["ACTIVE", "RESOLVED", "CHRONIC", "RULED_OUT"]).default("ACTIVE") }).strict();
const consultationMedicine = z.object({ medicineName: text, strength: text.optional(), dose: text.optional(), frequency: text.optional(), duration: text.optional(), route: text.optional(), quantity: z.number().int().positive().max(10000).default(1), instructions: text.optional() }).strict();
const consultationInput = clinicalScope.omit({ encounterId: true }).extend({
  appointmentId: uuid.optional(),
  complete: z.boolean().default(false),
  type: z.enum(["NEW_CONSULTATION", "FOLLOW_UP", "TELECONSULTATION", "PROCEDURE_REVIEW", "INPATIENT_ROUND", "EMERGENCY"]),
  chiefComplaint: note.optional(),
  history: note.optional(),
  examination: note.optional(),
  clinicalNotes: note.optional(),
  assessment: note.optional(),
  treatmentPlan: note.optional(),
  advice: note.optional(),
  followUpAdvice: note.optional(),
  diagnoses: z.array(consultationDiagnosis).max(20).default([]),
  prescription: z.object({ advice: note.optional(), status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"), medicines: z.array(consultationMedicine).min(1).max(50) }).strict().optional(),
  orders: z.array(z.object({ type: z.enum(["LABORATORY", "RADIOLOGY", "EXTERNAL_REPORT"]), title: text, priority: z.enum(["ROUTINE", "URGENT", "CRITICAL"]).default("ROUTINE"), source: text.optional(), doctorNotes: note.optional() }).strict()).max(20).default([]),
  followUp: z.object({ reason: text, dueAt: date.optional() }).strict().optional(),
});

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
  endpoint(router, "patch", "/appointments/:id", "hms.appointments.write", scope.extend({ patientId: uuid, doctorId: uuid, locationId: uuid.optional(), scheduledAt: date, durationMinutes: z.number().int().min(5).max(480), mode: z.enum(["IN_PERSON", "VIDEO", "HOME", "HOSPITAL"]), reason: text.optional() }), async ({ workplaceId, ...input }, { db, params }) => {
    const row = await db.appointments.findFirst({ where: { id: params.id, workplaceId } });
    if (!row) throw notFound("Appointment");
    await patient(db, input.patientId, workplaceId);
    await doctor(db, input.doctorId, workplaceId);
    if (input.locationId && !await db.workplace_locations.findFirst({ where: { id: input.locationId, workplaceId } })) throw notFound("Location");
    const end = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60000);
    const conflictRow = await db.appointments.findFirst({ where: { id: { not: row.id }, doctorId: input.doctorId, status: { notIn: ["CANCELLED", "NO_SHOW", "RESCHEDULED"] }, scheduledAt: { lt: end, gt: new Date(input.scheduledAt.getTime() - 480 * 60000) } } });
    if (conflictRow && conflictRow.scheduledAt.getTime() + conflictRow.durationMinutes * 60000 > input.scheduledAt.getTime()) throw conflict("Doctor is already booked", "SLOT_CONFLICT");
    return db.appointments.update({ where: { id: row.id }, data: { ...input, updatedAt: new Date() } });
  });
  endpoint(router, "delete", "/appointments/:id", "hms.appointments.write", scope, async (input, { db, params }) => {
    const row = await db.appointments.findFirst({ where: { id: params.id, workplaceId: input.workplaceId } });
    if (!row) throw notFound("Appointment");
    if (["COMPLETED", "IN_CONSULTATION"].includes(row.status)) throw conflict("Clinical appointments cannot be deleted");
    return db.appointments.update({ where: { id: row.id }, data: { status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date() } });
  });
  endpoint(router, "get", "/shifts", "hms.appointments.read", list.extend({ doctorId: uuid.optional() }), async (input, { db }) => db.doctor_shifts.findMany({ where: { workplaceId: input.workplaceId, doctorId: input.doctorId }, take: input.take, skip: input.skip, orderBy: { startsAt: "asc" } }));
  endpoint(router, "post", "/shifts", "hms.appointments.write", scope.extend({ doctorId: uuid, startsAt: date, endsAt: date, shiftType: z.enum(["CLINIC_OPD", "HOSPITAL_DUTY", "WARD_ROUND", "ON_CALL", "ONLINE_CONSULTATION", "BLOCKED", "LEAVE"]), bookingEnabled: z.boolean().default(true), slotMinutes: z.number().int().min(5).max(120).default(20), bufferMinutes: z.number().int().min(0).max(120).default(0), bookingLimit: z.number().int().positive().max(10000).optional(), recurrenceRule: text.optional(), note: note.optional() }), async (input, { db, context }) => {
    interval(input.startsAt, input.endsAt); await doctor(db, input.doctorId, input.workplaceId, context.roles.includes("hospital_doctor") ? context : undefined);
    if (await db.doctor_shifts.findFirst({ where: { doctorId: input.doctorId, status: { not: "CANCELLED" }, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } } })) throw conflict("Shift overlaps another shift", "SLOT_CONFLICT");
    return db.doctor_shifts.create({ data: { ...input, id: id(), updatedAt: new Date(), bookingEnabled: ["BLOCKED", "LEAVE"].includes(input.shiftType) ? false : input.bookingEnabled } });
  });
  endpoint(router, "patch", "/shifts/:id/status", "hms.appointments.write", scope.extend({ status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"]) }), async (input, { db, params, context }) => {
    const row = await db.doctor_shifts.findFirst({ where: { id: params.id, workplaceId: input.workplaceId } });
    if (!row) throw notFound("Shift");
    await doctor(db, row.doctorId, row.workplaceId, context.roles.includes("hospital_doctor") ? context : undefined);
    return db.doctor_shifts.update({ where: { id: row.id }, data: { status: input.status, updatedAt: new Date() } });
  });
  endpoint(router, "get", "/encounters", "hms.clinical.read", list.extend({ patientId: uuid.optional() }), async (input, { db }) => db.encounters.findMany({ where: { workplaceId: input.workplaceId, patientId: input.patientId }, take: input.take, skip: input.skip, orderBy: { createdAt: "desc" } }));
  endpoint(router, "post", "/encounters", "hms.clinical.write", consultationInput, async ({ appointmentId, complete, diagnoses, prescription, orders, followUp, ...input }, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); await doctor(db, input.doctorId, input.workplaceId, context);
    if (complete && !input.assessment) throw conflict("Diagnosis is required before completion");
    const now = new Date();
    if (appointmentId) {
      const appointment = await db.appointments.findFirst({ where: { id: appointmentId, workplaceId: input.workplaceId, patientId: input.patientId, doctorId: input.doctorId, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "WAITING", "IN_CONSULTATION"] } } });
      if (!appointment) throw conflict("Appointment must be active and match the encounter");
      const existing = await db.encounters.findFirst({ where: { appointmentId: appointment.id, patientId: input.patientId, doctorId: input.doctorId, workplaceId: input.workplaceId } });
      if (existing) {
        if (["CONSULTATION_COMPLETED", "CLOSED", "CANCELLED"].includes(existing.status) && !complete) throw conflict("Completed clinical records cannot be overwritten");
        if (complete && ["CONSULTATION_COMPLETED", "CLOSED"].includes(existing.status)) {
          return db.encounters.findUnique({ where: { id: existing.id }, include: { diagnoses: true, prescriptions: { include: { prescription_medications: true } }, investigation_orders: true, follow_ups: true } });
        }
        await db.appointments.update({ where: { id: appointment.id }, data: { status: complete ? "COMPLETED" : "IN_CONSULTATION", startedAt: appointment.startedAt ?? now, completedAt: complete ? now : appointment.completedAt, updatedAt: now } });
        return db.encounters.update({
          where: { id: existing.id },
          data: { ...input, updatedAt: now, ...(complete ? { status: "CONSULTATION_COMPLETED", completedAt: now } : { status: "CONSULTATION_STARTED", startedAt: existing.startedAt ?? now }) },
          include: { diagnoses: true, prescriptions: { include: { prescription_medications: true } }, investigation_orders: true, follow_ups: true },
        });
      }
      await db.appointments.update({ where: { id: appointment.id }, data: { status: complete ? "COMPLETED" : "IN_CONSULTATION", startedAt: now, completedAt: complete ? now : undefined, updatedAt: now } });
    }
    const encounterId = id();
    await db.encounters.create({ data: { ...input, appointmentId, id: encounterId, status: complete ? "CONSULTATION_COMPLETED" : "CONSULTATION_STARTED", startedAt: now, completedAt: complete ? now : undefined, updatedAt: now } });
    for (const diagnosis of diagnoses) {
      await db.diagnoses.create({ data: { ...diagnosis, id: id(), patientId: input.patientId, encounterId, updatedAt: new Date() } });
    }
    if (prescription) {
      await db.prescriptions.create({
        data: {
          id: id(), patientId: input.patientId, doctorId: input.doctorId, workplaceId: input.workplaceId, encounterId,
          advice: prescription.advice, status: prescription.status, issuedAt: new Date(), updatedAt: new Date(),
          prescription_medications: { create: prescription.medicines.map((medicineItem, index) => ({ ...medicineItem, quantity: String(medicineItem.quantity), id: id(), sortOrder: index, updatedAt: new Date() })) },
        },
      });
    }
    for (const order of orders) {
      await db.investigation_orders.create({ data: { ...order, id: id(), patientId: input.patientId, doctorId: input.doctorId, workplaceId: input.workplaceId, encounterId, updatedAt: new Date() } });
    }
    if (followUp) {
      await db.follow_ups.create({ data: { ...followUp, id: id(), patientId: input.patientId, doctorId: input.doctorId, workplaceId: input.workplaceId, encounterId, updatedAt: new Date() } });
    }
    return db.encounters.findUnique({ where: { id: encounterId }, include: { diagnoses: true, prescriptions: { include: { prescription_medications: true } }, investigation_orders: true, follow_ups: true } });
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
  endpoint(router, "post", "/diagnoses", "hms.clinical.write", scope.extend({ patientId: uuid, encounterId: uuid.optional(), doctorId: uuid.optional(), description: text, icdCode: z.string().max(25).optional(), type: z.enum(["PRIMARY", "SECONDARY", "PROVISIONAL", "CONFIRMED"]).default("PRIMARY"), status: z.enum(["ACTIVE", "RESOLVED", "CHRONIC", "RULED_OUT"]).default("ACTIVE") }), async ({ workplaceId, ...input }, { db, context }) => {
    await patient(db, input.patientId, workplaceId);
    if (input.encounterId) { const visit = await encounter(db, input.encounterId, input.patientId, workplaceId); await doctor(db, visit.doctorId, workplaceId, context); }
    else if (input.doctorId) await doctor(db, input.doctorId, workplaceId, context);
    return db.diagnoses.create({ data: { patientId: input.patientId, encounterId: input.encounterId, description: input.description, icdCode: input.icdCode, type: input.type, status: input.status, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "get", "/vitals", "hms.clinical.read", list.extend({ patientId: uuid }), async (input, { db }) => {
    await patient(db, input.patientId, input.workplaceId);
    return db.vital_sets.findMany({ where: { patientId: input.patientId, encounters: { workplaceId: input.workplaceId } }, take: input.take, skip: input.skip, orderBy: { recordedAt: "desc" } });
  });
  const vitals = scope.extend({ patientId: uuid, encounterId: uuid.optional(), systolicBp: z.number().int().min(1).max(350).optional(), diastolicBp: z.number().int().min(1).max(250).optional(), pulse: z.number().int().min(0).max(350).optional(), temperatureF: z.number().min(70).max(120).optional(), spo2: z.number().int().min(0).max(100).optional(), weightKg: z.number().positive().max(700).optional(), heightCm: z.number().positive().max(280).optional(), respiratoryRate: z.number().int().min(0).max(150).optional(), notes: note.optional() });
  endpoint(router, "post", "/vitals", "hms.vitals.write", vitals, async ({ workplaceId, ...input }, { db, context }) => {
    await patient(db, input.patientId, workplaceId);
    if (input.encounterId) {
      const visit = await encounter(db, input.encounterId, input.patientId, workplaceId);
      if (["CLOSED", "CANCELLED"].includes(visit.status)) throw conflict("Encounter is closed");
      if (context.roles.includes("hospital_doctor")) await doctor(db, visit.doctorId, workplaceId, context);
    }
    const account = await db.user_accounts.findUnique({ where: { authUserId: context.userId }, select: { id: true } });
    return db.vital_sets.create({ data: { ...input, id: id(), recordedById: account?.id, updatedAt: new Date() } });
  });
  endpoint(router, "get", "/investigations", "hms.clinical.read", list.extend({ patientId: uuid.optional() }), async (input, { db }) => db.investigation_orders.findMany({ where: { workplaceId: input.workplaceId, patientId: input.patientId }, include: { reports: true }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/investigations", "hms.clinical.write", clinicalScope.extend({ title: text, type: z.enum(["LABORATORY", "RADIOLOGY", "EXTERNAL_REPORT"]), priority: z.enum(["ROUTINE", "URGENT", "CRITICAL"]).default("ROUTINE"), doctorNotes: note.optional() }), async (input, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); await doctor(db, input.doctorId, input.workplaceId, context);
    if (input.encounterId) { const visit = await encounter(db, input.encounterId, input.patientId, input.workplaceId); if (visit.doctorId !== input.doctorId) throw conflict("Encounter doctor does not match"); }
    return db.investigation_orders.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "patch", "/investigations/:id/status", "hms.clinical.write", scope.extend({ status: z.enum(["PENDING", "ORDERED", "SAMPLE_COLLECTED", "IN_PROGRESS", "SCHEDULED", "RESULT_READY", "CRITICAL", "REVIEWED", "CANCELLED"]) }), async (input, { db, params }) => {
    const row = await db.investigation_orders.findFirst({ where: { id: params.id, workplaceId: input.workplaceId } });
    if (!row) throw notFound("Investigation order");
    return db.investigation_orders.update({ where: { id: row.id }, data: { status: input.status, reviewedAt: input.status === "REVIEWED" ? new Date() : row.reviewedAt, updatedAt: new Date() } });
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
