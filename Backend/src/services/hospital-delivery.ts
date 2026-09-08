import { prisma } from "../db/prisma";
import { serializable } from "../modules/hospital/common";

export type Delivery = { id: string; tenantId: string; channel: string; recipient: string; subject: string; body: string };
export type DeliveryAdapter = (delivery: Delivery) => Promise<void>;

// The receiving adapter MUST deduplicate by delivery.id. A crash after sending
// but before recording success can cause a retry of that same delivery.
export async function deliverOne(adapter: DeliveryAdapter): Promise<boolean> {
  const now = new Date();
  await prisma.hospitalOutbox.updateMany({ where: { status: "PROCESSING", attempts: { gte: 5 }, availableAt: { lt: now } }, data: { status: "DEAD_LETTER", lastError: "Delivery lease expired after final attempt" } });
  const claimed = await serializable(async db => {
    const row = await db.hospitalOutbox.findFirst({ where: { status: { in: ["QUEUED", "FAILED", "PROCESSING"] }, availableAt: { lte: now }, attempts: { lt: 5 } }, orderBy: { availableAt: "asc" } });
    if (!row) return null;
    return db.hospitalOutbox.update({ where: { id: row.id }, data: { status: "PROCESSING", attempts: { increment: 1 }, availableAt: new Date(now.getTime() + 120000) } });
  });
  if (!claimed) return false;
  try {
    await adapter(claimed);
    await prisma.hospitalOutbox.updateMany({ where: { id: claimed.id, status: "PROCESSING", attempts: claimed.attempts }, data: { status: "DELIVERED", deliveredAt: new Date(), lastError: null } });
  } catch {
    await prisma.hospitalOutbox.updateMany({ where: { id: claimed.id, status: "PROCESSING", attempts: claimed.attempts }, data: { status: claimed.attempts >= 5 ? "DEAD_LETTER" : "FAILED", lastError: "Delivery adapter failed; inspect provider logs using the delivery ID", availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** claimed.attempts)) } });
  }
  return true;
}
