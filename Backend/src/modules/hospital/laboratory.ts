import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma";
import { endpoint, scope, list, uuid, text, id, doctor, conflict } from "./common";
import { notFound } from "../../utils/errors";
import { appendLifecycleEvent } from "../../services/lifecycle";

export function laboratory(router: Router) {
  endpoint(router, "get", "/lab-services", "hms.read", list, async (input, { db, context }) => db.hospitalLabService.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, include: { test: true, service: true }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/lab-services", "hms.admin", scope.extend({ testId: z.string().min(1).max(100), serviceId: uuid }), async (input, { db, context }) => {
    if (!await db.testCatalogItem.findFirst({ where: { id: input.testId, tenantId: context.tenantId, status: "ACTIVE" } })) throw notFound("Lab test");
    if (!await db.clinic_services.findFirst({ where: { id: input.serviceId, workplaceId: input.workplaceId, isActive: true, price: { not: null } } })) throw notFound("Priced service");
    return db.hospitalLabService.upsert({ where: { workplaceId_testId: { workplaceId: input.workplaceId, testId: input.testId } }, create: { ...input, tenantId: context.tenantId }, update: { serviceId: input.serviceId } });
  });
  endpoint(router, "post", "/investigations/:id/send-to-lab", "hms.clinical.write", scope.extend({ testIds: z.array(z.string().min(1).max(100)).min(1).max(50), collectionLocation: text }), async (input, { db, context, params }) => {
    const investigation = await db.investigation_orders.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, type: "LABORATORY" }, include: { patients: true, laboratoryOrder: { include: { items: true } }, workplaces: true } });
    if (!investigation) throw notFound("Investigation"); await doctor(db, investigation.doctorId, input.workplaceId, context);
    if (investigation.laboratoryOrder) {
      const previous = investigation.laboratoryOrder.items.map(i => i.testId).sort();
      if (JSON.stringify(previous) !== JSON.stringify([...new Set(input.testIds)].sort())) throw conflict("Investigation already routed with different tests");
      return investigation.laboratoryOrder;
    }
    if (investigation.status !== "ORDERED") throw conflict("Investigation is not open");
    const siteId = investigation.workplaces.siteId;
    if (!siteId || !await db.site.findFirst({ where: { id: siteId, tenantId: context.tenantId } })) throw notFound("Mapped hospital site");
    const mappings = await db.hospitalLabService.findMany({ where: { workplaceId: input.workplaceId, tenantId: context.tenantId, testId: { in: input.testIds }, test: { status: "ACTIVE", tenantId: context.tenantId }, service: { isActive: true, workplaceId: input.workplaceId, price: { not: null } } }, include: { test: true, service: true } });
    if (mappings.length !== new Set(input.testIds).size) throw conflict("Every test requires an active administrator-configured price mapping");
    const platform = investigation.patients;
    let labPatient = await db.patient.findFirst({ where: { tenantId: context.tenantId, platformPatientId: platform.id } });
    labPatient ??= await db.patient.create({ data: { tenantId: context.tenantId, platformPatientId: platform.id, mrn: platform.qlynoId, name: platform.fullName, dateOfBirth: platform.dateOfBirth, sex: platform.gender === "MALE" ? "M" : platform.gender === "FEMALE" ? "F" : "O", contact: platform.phone ?? "Not recorded", source: "HOSPITAL_ENCOUNTER" } });
    const labEncounter = await db.encounter.upsert({ where: { tenantId_encounterNo: { tenantId: context.tenantId, encounterNo: `HMS-${investigation.encounterId ?? investigation.id}` } }, create: { tenantId: context.tenantId, patientId: labPatient.id, encounterNo: `HMS-${investigation.encounterId ?? investigation.id}`, status: "ACTIVE" }, update: {} });
    if (labEncounter.patientId !== labPatient.id) throw conflict("Encounter patient mismatch");
    const clinician = await doctor(db, investigation.doctorId, input.workplaceId);
    const priority = investigation.priority === "CRITICAL" ? "STAT" : investigation.priority === "URGENT" ? "URGENT" : "ROUTINE";
    const order = await db.laboratoryOrder.create({ data: { tenantId: context.tenantId, siteId, patientId: labPatient.id, encounterId: labEncounter.id, sourceInvestigationOrderId: investigation.id, source: "HOSPITAL_ENCOUNTER", billingAuthority: "HMS_CENTRAL", priority, status: "PLACED", orderingDoctor: clinician.fullName } });
    const task = await db.collectionTask.create({ data: { tenantId: context.tenantId, siteId, orderId: order.id, encounterId: labEncounter.id, location: input.collectionLocation, priority, scheduledAt: new Date(), status: "PENDING" } });
    const specimens = new Map<string, string>();
    for (const mapping of mappings) {
      const test = mapping.test; const group = `${test.specimenType}|${test.containerName}`; let specimenId = specimens.get(group);
      if (!specimenId) {
        const code = test.containerName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
        const container = await db.containerType.upsert({ where: { tenantId_code: { tenantId: context.tenantId, code } }, create: { tenantId: context.tenantId, code, type: test.containerName, color: "Mapped" }, update: {} });
        const specimen = await db.specimen.create({ data: { tenantId: context.tenantId, siteId, orderId: order.id, patientId: labPatient.id, containerTypeId: container.id, type: test.specimenType, status: "EXPECTED", collectionTaskLinks: { create: { tenantId: context.tenantId, collectionTaskId: task.id, requiredContainer: test.containerName } } } });
        specimenId = specimen.id; specimens.set(group, specimen.id);
      }
      const item = await db.laboratoryOrderItem.create({ data: { tenantId: context.tenantId, orderId: order.id, testId: test.id, departmentId: test.departmentId, status: "ORDERED", specimenLinks: { create: { tenantId: context.tenantId, specimenId } } } });
      const amount = mapping.service.price!;
      await db.laboratoryChargeLine.create({ data: { tenantId: context.tenantId, orderId: order.id, orderItemId: item.id, chargeType: "TEST", serviceCode: mapping.service.id, description: test.name, quantity: 1, unitPrice: amount, grossAmount: amount, discountAmount: 0, taxAmount: 0, netAmount: amount, billingAuthority: "HMS_CENTRAL" } });
    }
    await db.hospitalBillingPosting.create({ data: { tenantId: context.tenantId, orderId: order.id, postingVersion: 1, status: "READY_TO_POST" } });
    await appendLifecycleEvent(db, { tenantId: context.tenantId, orderId: order.id, type: "ORDER_PLACED", actorName: clinician.fullName, metadata: { investigationId: investigation.id } });
    return order;
  });
  endpoint(router, "get", "/investigations/:id/lab-report", "hms.clinical.read", scope, async (input, { db, context, params }) => {
    const order = await db.laboratoryOrder.findFirst({
      where: { tenantId: context.tenantId, sourceInvestigationOrder: { id: params.id, workplaceId: input.workplaceId } },
      include: { reports: { include: { versions: {
        where: { immutableAt: { not: null }, status: { in: ["FINAL", "CORRECTED", "AMENDED"] } },
        orderBy: { version: "desc" },
      } } } },
    });
    if (!order) throw notFound("Routed laboratory order"); return { orderId: order.id, status: order.status, reports: order.reports };
  });
  endpoint(router, "post", "/billing/laboratory-orders/:id/invoice", "hms.billing.write", scope, async (input, { db, context, params }) => {
    // Laboratory IDs are cuid/string IDs; this endpoint takes the UUID clinical investigation ID.
    const order = await db.laboratoryOrder.findFirst({ where: { tenantId: context.tenantId, sourceInvestigationOrder: { id: params.id, workplaceId: input.workplaceId }, billingAuthority: "HMS_CENTRAL" }, include: { sourceInvestigationOrder: true, chargeLines: true, hmsPostings: true } });
    if (!order?.sourceInvestigationOrder) throw notFound("Hospital laboratory order");
    const posting = order.hmsPostings.find(p => p.postingVersion === 1); if (!posting) throw notFound("Billing posting");
    if (posting.hmsBillId) return db.billing_invoices.findFirst({ where: { id: posting.hmsBillId, workplaceId: input.workplaceId } });
    if (posting.status !== "READY_TO_POST" || order.status === "CANCELLED" || !order.chargeLines.length) throw conflict("Posting is not ready");
    const subtotal = order.chargeLines.reduce((sum, line) => sum.plus(line.netAmount), new Prisma.Decimal(0));
    if (order.chargeLines.some(line => !line.quantity.isInteger() || line.quantity.lte(0) || !line.netAmount.eq(line.quantity.times(line.unitPrice)))) throw conflict("Posting requires reconciliation before invoicing");
    const invoice = await db.billing_invoices.create({ data: { id: id(), invoiceNumber: `INV-${id()}`, patientId: order.sourceInvestigationOrder.patientId, workplaceId: input.workplaceId, subtotal, total: subtotal, updatedAt: new Date(), lines: { create: order.chargeLines.map(line => ({ tenantId: context.tenantId, description: line.description, serviceCode: line.serviceCode, quantity: line.quantity.toNumber(), unitPrice: line.unitPrice, amount: line.netAmount })) } }, include: { lines: true } });
    await db.hospitalBillingPosting.update({ where: { id: posting.id }, data: { status: "POSTED", hmsBillId: invoice.id, hmsBillNumber: invoice.invoiceNumber, postedAmount: subtotal, postedAt: new Date() } });
    return invoice;
  });
}
