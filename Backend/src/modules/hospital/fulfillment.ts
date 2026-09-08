import { Router } from "express";
import { z } from "zod";
import { endpoint, scope, list, uuid, text, note, date, money, key, id, conflict, fingerprint, replay, transition } from "./common";
import { notFound } from "../../utils/errors";

export function fulfillment(router: Router) {
  endpoint(router, "get", "/pharmacy/prescriptions", "hms.pharmacy.read", list, async (input, { db }) => db.prescriptions.findMany({ where: { workplaceId: input.workplaceId, status: "ACTIVE" }, include: { prescription_medications: true }, take: input.take, skip: input.skip }));
  endpoint(router, "get", "/pharmacy/batches", "hms.pharmacy.read", list, async (input, { db, context }) => db.pharmacyBatch.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, orderBy: { expiresAt: "asc" }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/pharmacy/batches", "hms.pharmacy.write", scope.extend({ medicineName: text, batchNumber: text, expiresAt: date, quantity: z.number().int().min(0).max(1000000), unitPrice: money }), async (input, { db, context }) => {
    if (input.expiresAt <= new Date()) throw conflict("Cannot receive an expired batch");
    return db.pharmacyBatch.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "get", "/pharmacy/dispenses", "hms.pharmacy.read", list, async (input, { db, context }) => db.pharmacyDispense.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { dispensedAt: "desc" } }));
  endpoint(router, "post", "/pharmacy/dispenses", "hms.pharmacy.write", scope.extend({ patientId: uuid, prescriptionMedicationId: uuid, batchId: uuid, quantity: z.number().int().positive().max(10000), idempotencyKey: key }), async (input, { db, context }) => {
    const hash = fingerprint(input);
    const existing = replay(await db.pharmacyDispense.findUnique({ where: { tenantId_idempotencyKey: { tenantId: context.tenantId, idempotencyKey: input.idempotencyKey } } }), hash); if (existing) return existing;
    const medication = await db.prescription_medications.findFirst({ where: { id: input.prescriptionMedicationId, prescriptions: { patientId: input.patientId, workplaceId: input.workplaceId, status: "ACTIVE" } } });
    if (!medication) throw notFound("Active prescribed medication");
    const batch = await db.pharmacyBatch.findFirst({ where: { id: input.batchId, tenantId: context.tenantId, workplaceId: input.workplaceId } });
    if (!batch || batch.medicineName.trim().toLowerCase() !== medication.medicineName.trim().toLowerCase()) throw conflict("Batch must match prescribed medicine");
    const previous = await db.pharmacyDispense.aggregate({ where: { prescriptionMedicationId: medication.id }, _sum: { quantity: true } });
    const prescribed = Number(medication.quantity);
    if (!Number.isSafeInteger(prescribed) || prescribed <= 0 || (previous._sum.quantity ?? 0) + input.quantity > prescribed) throw conflict("Dispense exceeds prescribed quantity", "OVER_DISPENSE");
    const updated = await db.pharmacyBatch.updateMany({ where: { id: batch.id, quantity: { gte: input.quantity }, expiresAt: { gt: new Date() } }, data: { quantity: { decrement: input.quantity } } });
    if (updated.count !== 1) throw conflict("Insufficient stock or expired batch", "STOCK_UNAVAILABLE");
    return db.pharmacyDispense.create({ data: { ...input, tenantId: context.tenantId, dispensedBy: context.userId, requestHash: hash } });
  });
  endpoint(router, "get", "/radiology/orders", "hms.radiology.read", list, async (input, { db }) => db.investigation_orders.findMany({ where: { workplaceId: input.workplaceId, type: "RADIOLOGY", status: { not: "CANCELLED" } }, take: input.take, skip: input.skip }));
  endpoint(router, "get", "/radiology/studies", "hms.radiology.read", list, async (input, { db, context }) => db.radiologyStudy.findMany({ where: { workplaceId: input.workplaceId, tenantId: context.tenantId }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/radiology/studies", "hms.radiology.write", scope.extend({ orderId: uuid, modality: z.enum(["XRAY", "CT", "MRI", "ULTRASOUND", "MAMMOGRAPHY", "OTHER"]), scheduledAt: date.optional() }), async (input, { db, context }) => {
    const order = await db.investigation_orders.findFirst({ where: { id: input.orderId, workplaceId: input.workplaceId, type: "RADIOLOGY", status: "ORDERED" } }); if (!order) throw notFound("Pending radiology order");
    await db.investigation_orders.update({ where: { id: order.id }, data: { status: "SCHEDULED", scheduledAt: input.scheduledAt, updatedAt: new Date() } });
    return db.radiologyStudy.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "patch", "/radiology/studies/:id", "hms.radiology.write", scope.extend({ status: z.enum(["IN_PROGRESS", "DRAFT", "RELEASED", "CANCELLED"]), findings: note.optional(), impression: note.optional(), critical: z.boolean().optional() }), async (input, { db, context, params }) => {
    const row = await db.radiologyStudy.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, tenantId: context.tenantId } }); if (!row) throw notFound("Study");
    if (row.releasedAt) throw conflict("Released studies are immutable; a correction must be separately recorded", "REPORT_IMMUTABLE");
    transition(row.status, input.status, { SCHEDULED: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["DRAFT", "CANCELLED"], DRAFT: ["DRAFT", "RELEASED"] });
    const findings = input.findings ?? row.findings; const impression = input.impression ?? row.impression;
    if (input.status === "RELEASED" && (!findings || !impression)) throw conflict("Findings and impression are required");
    const { workplaceId: _, ...data } = input;
    const study = await db.radiologyStudy.update({ where: { id: row.id }, data: { ...data, ...(input.status === "RELEASED" ? { releasedAt: new Date(), reportedBy: context.userId } : {}) } });
    await db.investigation_orders.update({ where: { id: row.orderId }, data: { status: input.status === "RELEASED" ? (study.critical ? "CRITICAL" : "RESULT_READY") : input.status === "CANCELLED" ? "CANCELLED" : "IN_PROGRESS", updatedAt: new Date() } });
    if (input.status === "RELEASED") {
      const order = await db.investigation_orders.findUniqueOrThrow({ where: { id: row.orderId } });
      await db.reports.create({ data: { id: id(), orderId: order.id, resultSummary: findings, interpretation: impression, isCritical: study.critical, resultAt: new Date(), status: study.critical ? "CRITICAL" : "RESULT_READY", updatedAt: new Date() } });
    }
    return study;
  });
}
