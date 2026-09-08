import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma";
import { endpoint, scope, list, uuid, text, note, money, positiveMoney, key, id, patient, conflict, fingerprint, replay, transition, Db } from "./common";
import { notFound, forbidden } from "../../utils/errors";

export function calculateInvoice(lines: Array<{ quantity: number; unitPrice: Prisma.Decimal }>, discount = new Prisma.Decimal(0), tax = new Prisma.Decimal(0)) {
  const subtotal = lines.reduce((sum, line) => sum.plus(line.unitPrice.times(line.quantity)), new Prisma.Decimal(0));
  if (discount.gt(subtotal)) throw conflict("Discount exceeds subtotal", "INVALID_AMOUNT");
  const total = subtotal.minus(discount).plus(tax);
  if (total.gt("99999999.99")) throw conflict("Invoice exceeds supported amount", "INVALID_AMOUNT");
  return { subtotal, discount, tax, total };
}
async function invoice(db: Db, invoiceId: string, workplaceId: string) {
  const row = await db.billing_invoices.findFirst({ where: { id: invoiceId, workplaceId }, include: { lines: true, payment_txns: true, refunds: true, claims: true } });
  if (!row) throw notFound("Invoice"); return row;
}
const sum = (rows: Array<{ amount: Prisma.Decimal }>) => rows.reduce((a, b) => a.plus(b.amount), new Prisma.Decimal(0));

export function billing(router: Router) {
  endpoint(router, "get", "/billing/invoices", "hms.billing.read", list.extend({ patientId: uuid.optional() }), async (input, { db }) => db.billing_invoices.findMany({ where: { workplaceId: input.workplaceId, patientId: input.patientId }, include: { lines: true, payment_txns: true, refunds: true }, take: input.take, skip: input.skip, orderBy: { issuedAt: "desc" } }));
  endpoint(router, "get", "/billing/invoices/:id", "hms.billing.read", scope, async (input, { db, params }) => invoice(db, params.id!, input.workplaceId));
  endpoint(router, "post", "/billing/invoices", "hms.billing.write", scope.extend({ patientId: uuid, idempotencyKey: key, notes: note.optional(), lines: z.array(z.object({ serviceId: uuid, quantity: z.number().int().positive().max(1000) }).strict()).min(1).max(100) }), async (input, { db, context }) => {
    const hash = fingerprint(input);
    const existing = replay(await db.billing_invoices.findUnique({ where: { workplaceId_idempotencyKey: { workplaceId: input.workplaceId, idempotencyKey: input.idempotencyKey } } }), hash); if (existing) return existing;
    await patient(db, input.patientId, input.workplaceId);
    const services = await db.clinic_services.findMany({ where: { id: { in: input.lines.map(line => line.serviceId) }, workplaceId: input.workplaceId, isActive: true } });
    const lines = input.lines.map(line => {
      const service = services.find(item => item.id === line.serviceId); if (!service || service.price === null) throw notFound("Priced service");
      return { tenantId: context.tenantId, description: service.name, serviceCode: service.id, quantity: line.quantity, unitPrice: service.price, amount: service.price.times(line.quantity) };
    });
    return db.billing_invoices.create({ data: { id: id(), invoiceNumber: `INV-${id()}`, workplaceId: input.workplaceId, patientId: input.patientId, notes: input.notes, idempotencyKey: input.idempotencyKey, requestHash: hash, ...calculateInvoice(lines), updatedAt: new Date(), lines: { create: lines } }, include: { lines: true } });
  });
  endpoint(router, "patch", "/billing/invoices/:id/adjustment", "hms.billing.approve", scope.extend({ discount: money, tax: money, reason: note }), async (input, { db, params }) => {
    const row = await invoice(db, params.id!, input.workplaceId);
    if (row.finalizedAt || row.status === "CANCELLED") throw conflict("Only draft invoices may be adjusted");
    return db.billing_invoices.update({ where: { id: row.id }, data: { ...calculateInvoice(row.lines, input.discount, input.tax), notes: input.reason, updatedAt: new Date() } });
  });
  endpoint(router, "post", "/billing/invoices/:id/finalize", "hms.billing.write", scope, async (input, { db, params }) => {
    const row = await invoice(db, params.id!, input.workplaceId); if (row.status === "CANCELLED") throw conflict("Invoice is cancelled"); if (row.finalizedAt) return row;
    if (!row.lines.length) throw conflict("Invoice needs itemized lines before finalization");
    return db.billing_invoices.update({ where: { id: row.id }, data: { finalizedAt: new Date(), status: row.total.isZero() ? "PAID" : "UNPAID", updatedAt: new Date() } });
  });
  endpoint(router, "post", "/billing/invoices/:id/cancel", "hms.billing.approve", scope.extend({ reason: note }), async (input, { db, params }) => {
    const row = await invoice(db, params.id!, input.workplaceId);
    if (row.payment_txns.length || row.claims.some(c => c.status !== "REJECTED")) throw conflict("Invoices with payments or active claims cannot be cancelled");
    return db.billing_invoices.update({ where: { id: row.id }, data: { status: "CANCELLED", notes: input.reason, updatedAt: new Date() } });
  });
  endpoint(router, "post", "/billing/invoices/:id/payments", "hms.billing.payment", scope.extend({ amount: positiveMoney, method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "INSURANCE"]), reference: text.optional(), idempotencyKey: key }), async (input, { db, params }) => {
    const row = await invoice(db, params.id!, input.workplaceId); const hash = fingerprint(input);
    const existing = replay(row.payment_txns.find(item => item.idempotencyKey === input.idempotencyKey) ?? null, hash); if (existing) return existing;
    if (!row.finalizedAt || ["CANCELLED", "REFUNDED"].includes(row.status)) throw conflict("Invoice is not open for payment");
    const paid = sum(row.payment_txns.filter(item => item.status === "PAID"));
    if (paid.plus(input.amount).gt(row.total)) throw conflict("Payment exceeds outstanding balance", "OVERPAYMENT");
    const receipt = await db.payment_txns.create({ data: { id: id(), invoiceId: row.id, amount: input.amount, method: input.method, reference: input.reference, idempotencyKey: input.idempotencyKey, requestHash: hash } });
    await db.billing_invoices.update({ where: { id: row.id }, data: { status: paid.plus(input.amount).eq(row.total) ? "PAID" : "PARTIALLY_PAID", updatedAt: new Date() } });
    return receipt;
  });
  endpoint(router, "get", "/billing/payments", "hms.billing.read", list, async (input, { db }) => db.payment_txns.findMany({ where: { billing_invoices: { workplaceId: input.workplaceId } }, take: input.take, skip: input.skip, orderBy: { collectedAt: "desc" } }));
  endpoint(router, "get", "/billing/refunds", "hms.billing.read", list, async (input, { db, context }) => db.hospitalRefund.findMany({ where: { tenantId: context.tenantId, invoice: { workplaceId: input.workplaceId } }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/billing/invoices/:id/refunds", "hms.billing.refund", scope.extend({ amount: positiveMoney, reason: note, idempotencyKey: key }), async (input, { db, params, context }) => {
    const row = await invoice(db, params.id!, input.workplaceId); const hash = fingerprint(input);
    const existing = replay(row.refunds.find(item => item.idempotencyKey === input.idempotencyKey) ?? null, hash); if (existing) return existing;
    const available = sum(row.payment_txns.filter(p => p.status === "PAID")).minus(sum(row.refunds.filter(r => r.status !== "REJECTED")));
    if (input.amount.gt(available)) throw conflict("Refund exceeds unreserved captured payments", "INVALID_REFUND");
    return db.hospitalRefund.create({ data: { tenantId: context.tenantId, invoiceId: row.id, amount: input.amount, reason: input.reason, requestedBy: context.userId, idempotencyKey: input.idempotencyKey, requestHash: hash } });
  });
  endpoint(router, "post", "/billing/refunds/:id/decision", "hms.billing.approve", scope.extend({ status: z.enum(["APPROVED", "REJECTED"]), reason: note }), async (input, { db, params, context }) => {
    const refund = await db.hospitalRefund.findFirst({ where: { id: params.id, tenantId: context.tenantId, invoice: { workplaceId: input.workplaceId } } }); if (!refund) throw notFound("Refund");
    if (refund.requestedBy === context.userId) throw forbidden();
    transition(refund.status, input.status, { REQUESTED: ["APPROVED", "REJECTED"] });
    return db.hospitalRefund.update({ where: { id: refund.id }, data: { status: input.status, approvedBy: context.userId, reason: `${refund.reason}\nDecision: ${input.reason}` } });
  });
  endpoint(router, "post", "/billing/refunds/:id/complete", "hms.billing.payment", scope.extend({ reference: text }), async (input, { db, params, context }) => {
    const refund = await db.hospitalRefund.findFirst({ where: { id: params.id, tenantId: context.tenantId, invoice: { workplaceId: input.workplaceId } } }); if (!refund) throw notFound("Refund");
    if (refund.status === "COMPLETED") return refund;
    transition(refund.status, "COMPLETED", { APPROVED: ["COMPLETED"] });
    const updated = await db.hospitalRefund.update({ where: { id: refund.id }, data: { status: "COMPLETED", reason: `${refund.reason}\nManual payout reference: ${input.reference}` } });
    const row = await invoice(db, refund.invoiceId, input.workplaceId);
    const refunded = sum(row.refunds.filter(r => r.status === "COMPLETED"));
    const captured = sum(row.payment_txns.filter(p => p.status === "PAID"));
    if (refunded.eq(captured)) {
      await db.billing_invoices.update({ where: { id: row.id }, data: { status: "REFUNDED", updatedAt: new Date() } });
    }
    return updated;
  });
  endpoint(router, "get", "/billing/summary", "hms.billing.read", scope, async (input, { db }) => {
    const where = { workplaceId: input.workplaceId };
    const [invoices, payments, refunds] = await Promise.all([
      db.billing_invoices.groupBy({ by: ["status"], where, _sum: { total: true }, _count: true }),
      db.payment_txns.aggregate({ where: { billing_invoices: where, status: "PAID" }, _sum: { amount: true } }),
      db.hospitalRefund.aggregate({ where: { invoice: where, status: "COMPLETED" }, _sum: { amount: true } }),
    ]); return { invoices, payments, refunds };
  });
  endpoint(router, "get", "/billing/payers", "hms.billing.read", scope, async (_, { db, context }) => db.hospitalPayer.findMany({ where: { tenantId: context.tenantId }, take: 100 }));
  endpoint(router, "post", "/billing/payers", "hms.insurance.write", scope.extend({ name: text, type: z.enum(["INSURER", "TPA", "CORPORATE", "GOVERNMENT"]), contactEmail: z.string().email().optional() }), async ({ workplaceId: _, ...input }, { db, context }) => db.hospitalPayer.create({ data: { ...input, tenantId: context.tenantId } }));
  endpoint(router, "get", "/billing/claims", "hms.billing.read", list, async (input, { db, context }) => db.insuranceClaim.findMany({ where: { tenantId: context.tenantId, invoice: { workplaceId: input.workplaceId } }, include: { payer: true }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/billing/claims", "hms.insurance.write", scope.extend({ invoiceId: uuid, payerId: uuid, policyNumber: text, claimedAmount: positiveMoney, preauthorizationNumber: text.optional() }), async ({ workplaceId, ...input }, { db, context }) => {
    const row = await invoice(db, input.invoiceId, workplaceId);
    if (!row.finalizedAt || row.status === "CANCELLED") throw conflict("Claim requires a finalized invoice");
    const reserved = row.claims.filter(c => c.status !== "REJECTED").reduce((a, c) => a.plus(c.claimedAmount), new Prisma.Decimal(0));
    if (reserved.plus(input.claimedAmount).gt(row.total)) throw conflict("Claims exceed invoice total");
    if (!await db.hospitalPayer.findFirst({ where: { id: input.payerId, tenantId: context.tenantId, active: true } })) throw notFound("Payer");
    return db.insuranceClaim.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "patch", "/billing/claims/:id", "hms.insurance.write", scope.extend({ status: z.enum(["SUBMITTED", "APPROVED", "REJECTED"]), approvedAmount: money.optional(), notes: note }), async (input, { db, context, params }) => {
    const row = await db.insuranceClaim.findFirst({ where: { id: params.id, tenantId: context.tenantId, invoice: { workplaceId: input.workplaceId } } }); if (!row) throw notFound("Claim");
    transition(row.status, input.status, { DRAFT: ["SUBMITTED"], SUBMITTED: ["APPROVED", "REJECTED"] });
    if (input.status === "APPROVED" && (!input.approvedAmount || input.approvedAmount.gt(row.claimedAmount))) throw conflict("Approved amount must be supplied and cannot exceed claim");
    return db.insuranceClaim.update({ where: { id: row.id }, data: { status: input.status, approvedAmount: input.status === "APPROVED" ? input.approvedAmount : undefined, notes: input.notes } });
  });
}
