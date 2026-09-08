import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { deliverOne } from "../services/hospital-delivery";
import { prisma } from "../db/prisma";

async function main() {
  const endpoint = process.env.HOSPITAL_DELIVERY_WEBHOOK_URL;
  const token = process.env.HOSPITAL_DELIVERY_WEBHOOK_TOKEN;
  if (!endpoint || !token) throw new Error("Configure HOSPITAL_DELIVERY_WEBHOOK_URL and HOSPITAL_DELIVERY_WEBHOOK_TOKEN before starting the worker");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Delivery webhook must use HTTPS");
  let running = true;
  process.on("SIGTERM", () => { running = false; }); process.on("SIGINT", () => { running = false; });
  while (running) {
    const worked = await deliverOne(async delivery => {
      const response = await fetch(url, { method: "POST", redirect: "error", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": delivery.id }, body: JSON.stringify(delivery), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Delivery adapter rejected message");
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("delivered" in result) || result.delivered !== true) throw new Error("Adapter did not confirm delivery");
    });
    if (!worked) await delay(1000);
  }
}
main().catch(() => { console.error("Hospital delivery worker stopped; check configuration and database availability"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
