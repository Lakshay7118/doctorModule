import { Router } from "express";
import { z } from "zod";
import { endpoint, scope, list, uuid, text, note, date, money, patient, doctor, encounter, conflict, interval, transition } from "./common";
import { notFound } from "../../utils/errors";

export function care(router: Router) {
  endpoint(router, "get", "/wards", "hms.care.read", list, async (input, { db, context }) => db.hospitalWard.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, include: { beds: true }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/wards", "hms.admin", scope.extend({ name: text, type: z.enum(["GENERAL", "ICU", "ISOLATION", "MATERNITY", "PEDIATRIC", "PRIVATE"]) }), async (input, { db, context }) => db.hospitalWard.create({ data: { ...input, tenantId: context.tenantId } }));
  endpoint(router, "post", "/beds", "hms.admin", scope.extend({ wardId: uuid, code: text, dailyRate: money }), async (input, { db, context }) => {
    if (!await db.hospitalWard.findFirst({ where: { id: input.wardId, workplaceId: input.workplaceId, tenantId: context.tenantId } })) throw notFound("Ward");
    return db.hospitalBed.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "get", "/beds", "hms.care.read", list, async (input, { db, context }) => db.hospitalBed.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, include: { ward: true }, take: input.take, skip: input.skip }));
  endpoint(router, "patch", "/beds/:id/status", "hms.admissions.write", scope.extend({ status: z.enum(["AVAILABLE", "CLEANING", "MAINTENANCE"]) }), async (input, { db, context, params }) => {
    const row = await db.hospitalBed.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, tenantId: context.tenantId } }); if (!row) throw notFound("Bed");
    transition(row.status, input.status, { CLEANING: ["AVAILABLE", "MAINTENANCE"], MAINTENANCE: ["CLEANING"], AVAILABLE: ["MAINTENANCE", "CLEANING"] });
    return db.hospitalBed.update({ where: { id: row.id }, data: { status: input.status } });
  });
  endpoint(router, "get", "/admissions", "hms.care.read", list, async (input, { db, context }) => db.hospitalAdmission.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, include: { bed: { include: { ward: true } } }, take: input.take, skip: input.skip, orderBy: { admittedAt: "desc" } }));
  endpoint(router, "post", "/admissions", "hms.admissions.write", scope.extend({ patientId: uuid, encounterId: uuid, bedId: uuid }), async (input, { db, context }) => {
    await patient(db, input.patientId, input.workplaceId); const visit = await encounter(db, input.encounterId, input.patientId, input.workplaceId);
    if (["CLOSED", "CANCELLED"].includes(visit.status)) throw conflict("Encounter is closed");
    if (await db.hospitalAdmission.findFirst({ where: { patientId: input.patientId, status: "ADMITTED" } })) throw conflict("Patient already has an active admission");
    const allocated = await db.hospitalBed.updateMany({ where: { id: input.bedId, tenantId: context.tenantId, workplaceId: input.workplaceId, status: "AVAILABLE" }, data: { status: "OCCUPIED" } });
    if (allocated.count !== 1) throw conflict("Bed is unavailable", "BED_UNAVAILABLE");
    await db.encounters.update({ where: { id: visit.id }, data: { status: "ADMITTED", updatedAt: new Date() } });
    return db.hospitalAdmission.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "post", "/admissions/:id/transfer", "hms.admissions.write", scope.extend({ bedId: uuid }), async (input, { db, context, params }) => {
    const admission = await db.hospitalAdmission.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, tenantId: context.tenantId, status: "ADMITTED" } }); if (!admission) throw notFound("Active admission");
    const allocated = await db.hospitalBed.updateMany({ where: { id: input.bedId, workplaceId: input.workplaceId, tenantId: context.tenantId, status: "AVAILABLE" }, data: { status: "OCCUPIED" } });
    if (allocated.count !== 1) throw conflict("Bed is unavailable", "BED_UNAVAILABLE");
    await db.hospitalBed.update({ where: { id: admission.bedId }, data: { status: "CLEANING" } });
    return db.hospitalAdmission.update({ where: { id: admission.id }, data: { bedId: input.bedId, doctorCleared: false, nursingCleared: false } });
  });
  endpoint(router, "post", "/admissions/:id/doctor-clearance", "hms.discharge.doctor", scope.extend({ dischargeSummary: note }), async (input, { db, context, params }) => {
    const row = await db.hospitalAdmission.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, tenantId: context.tenantId, status: "ADMITTED" } }); if (!row) throw notFound("Active admission");
    const visit = await encounter(db, row.encounterId, row.patientId, row.workplaceId); await doctor(db, visit.doctorId, row.workplaceId, context);
    return db.hospitalAdmission.update({ where: { id: row.id }, data: { doctorCleared: true, dischargeSummary: input.dischargeSummary } });
  });
  endpoint(router, "post", "/admissions/:id/nursing-clearance", "hms.discharge.nursing", scope, async (input, { db, params, context }) => {
    const row = await db.hospitalAdmission.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, tenantId: context.tenantId, status: "ADMITTED" } }); if (!row) throw notFound("Active admission");
    return db.hospitalAdmission.update({ where: { id: row.id }, data: { nursingCleared: true } });
  });
  endpoint(router, "post", "/admissions/:id/discharge", "hms.admissions.write", scope, async (input, { db, params, context }) => {
    const row = await db.hospitalAdmission.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, tenantId: context.tenantId, status: "ADMITTED" } }); if (!row) throw notFound("Active admission");
    if (!row.doctorCleared || !row.nursingCleared) throw conflict("Doctor and nursing clearance are required", "DISCHARGE_BLOCKED");
    if (await db.billing_invoices.count({ where: { workplaceId: row.workplaceId, patientId: row.patientId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } } })) throw conflict("Outstanding invoices require settlement", "DISCHARGE_BLOCKED");
    if (await db.hospitalSurgery.count({ where: { encounterId: row.encounterId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } })) throw conflict("Surgical care is still active", "DISCHARGE_BLOCKED");
    await db.hospitalBed.update({ where: { id: row.bedId }, data: { status: "CLEANING" } });
    await db.encounters.update({ where: { id: row.encounterId }, data: { status: "CLOSED", completedAt: new Date(), updatedAt: new Date() } });
    return db.hospitalAdmission.update({ where: { id: row.id }, data: { status: "DISCHARGED", dischargedAt: new Date() } });
  });
  endpoint(router, "get", "/nursing/notes", "hms.clinical.read", list.extend({ encounterId: uuid }), async (input, { db, context }) => db.nursingNote.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId, encounterId: input.encounterId }, take: input.take, skip: input.skip, orderBy: { recordedAt: "desc" } }));
  endpoint(router, "post", "/nursing/notes", "hms.nursing.write", scope.extend({ patientId: uuid, encounterId: uuid, kind: z.enum(["OBSERVATION", "CARE_PLAN", "HANDOVER", "INCIDENT"]), note }), async (input, { db, context }) => {
    const visit = await encounter(db, input.encounterId, input.patientId, input.workplaceId); if (["CLOSED", "CANCELLED"].includes(visit.status)) throw conflict("Encounter is closed");
    return db.nursingNote.create({ data: { ...input, tenantId: context.tenantId, authorUserId: context.userId } });
  });
  endpoint(router, "get", "/nursing/medications", "hms.clinical.read", list.extend({ encounterId: uuid }), async (input, { db, context }) => db.medicationAdministration.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId, encounterId: input.encounterId }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/nursing/medications", "hms.nursing.write", scope.extend({ patientId: uuid, encounterId: uuid, prescriptionMedicationId: uuid, scheduledAt: date, status: z.enum(["GIVEN", "HELD", "REFUSED", "OMITTED"]), note: note.optional() }), async (input, { db, context }) => {
    const visit = await encounter(db, input.encounterId, input.patientId, input.workplaceId); if (["CLOSED", "CANCELLED"].includes(visit.status)) throw conflict("Encounter is closed");
    if (!await db.prescription_medications.findFirst({ where: { id: input.prescriptionMedicationId, prescriptions: { encounterId: input.encounterId, workplaceId: input.workplaceId, patientId: input.patientId, status: "ACTIVE" } } })) throw notFound("Active prescribed medication");
    if (input.status !== "GIVEN" && !input.note) throw conflict("A reason is required when medication is not given");
    return db.medicationAdministration.create({ data: { ...input, tenantId: context.tenantId, administeredBy: context.userId } });
  });
  endpoint(router, "get", "/surgeries", "hms.care.read", list, async (input, { db, context }) => db.hospitalSurgery.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { startsAt: "asc" } }));
  endpoint(router, "post", "/surgeries", "hms.surgery.write", scope.extend({ patientId: uuid, encounterId: uuid, surgeonId: uuid, roomId: uuid, procedure: text, startsAt: date, endsAt: date }), async (input, { db, context }) => {
    interval(input.startsAt, input.endsAt); await encounter(db, input.encounterId, input.patientId, input.workplaceId); await doctor(db, input.surgeonId, input.workplaceId, context);
    if (!await db.clinic_rooms.findFirst({ where: { id: input.roomId, workplaceId: input.workplaceId, roomType: "OT", status: "ACTIVE" } })) throw notFound("Operating room");
    if (await db.hospitalSurgery.findFirst({ where: { OR: [{ roomId: input.roomId }, { surgeonId: input.surgeonId }], status: { in: ["SCHEDULED", "IN_PROGRESS"] }, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } } })) throw conflict("Surgeon or operating room is already booked", "SLOT_CONFLICT");
    return db.hospitalSurgery.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "patch", "/surgeries/:id", "hms.surgery.write", scope.extend({ status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]), consentRecorded: z.boolean().optional(), preOpCleared: z.boolean().optional(), operativeNote: note.optional() }), async (input, { db, params, context }) => {
    const row = await db.hospitalSurgery.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Surgery"); await doctor(db, row.surgeonId, row.workplaceId, context);
    transition(row.status, input.status, { SCHEDULED: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["COMPLETED"] });
    if (input.status === "IN_PROGRESS" && (!(input.consentRecorded ?? row.consentRecorded) || !(input.preOpCleared ?? row.preOpCleared))) throw conflict("Consent and pre-operative clearance are required");
    if (input.status === "COMPLETED" && !input.operativeNote) throw conflict("Operative note is required");
    const { workplaceId: _, ...data } = input; return db.hospitalSurgery.update({ where: { id: row.id }, data });
  });
  endpoint(router, "get", "/emergency", "hms.care.read", list, async (input, { db, context }) => db.emergencyCase.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { arrivedAt: "asc" } }));
  endpoint(router, "post", "/emergency", "hms.nursing.write", scope.extend({ patientId: uuid, encounterId: uuid, triageLevel: z.enum(["RESUSCITATION", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"]), complaint: note }), async (input, { db, context }) => {
    const visit = await encounter(db, input.encounterId, input.patientId, input.workplaceId); if (visit.type !== "EMERGENCY") throw conflict("Emergency encounter required");
    return db.emergencyCase.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "patch", "/emergency/:id/status", "hms.clinical.write", scope.extend({ status: z.enum(["IN_TREATMENT", "ADMITTED", "DISCHARGED", "TRANSFERRED"]) }), async (input, { db, params, context }) => {
    const row = await db.emergencyCase.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Emergency case");
    const visit = await encounter(db, row.encounterId, row.patientId, row.workplaceId); await doctor(db, visit.doctorId, row.workplaceId, context);
    transition(row.status, input.status, { WAITING: ["IN_TREATMENT"], IN_TREATMENT: ["ADMITTED", "DISCHARGED", "TRANSFERRED"] });
    if (input.status === "ADMITTED" && !await db.hospitalAdmission.findFirst({ where: { encounterId: row.encounterId, status: "ADMITTED" } })) throw conflict("Create admission and allocate bed first");
    return db.emergencyCase.update({ where: { id: row.id }, data: { status: input.status } });
  });
}
