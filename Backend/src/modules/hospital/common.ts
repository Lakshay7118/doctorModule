import { createHash, randomUUID } from "node:crypto";
import type { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma";
import { prisma } from "../../db/prisma";
import type { RequestContext } from "../../types/security";
import { requirePermission, rejectAuditorWrites } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { AppError, notFound, forbidden } from "../../utils/errors";

export const uuid = z.string().uuid();
export const text = z.string().trim().min(1).max(500);
export const note = z.string().trim().min(1).max(12000);
export const date = z.string().datetime({ offset: true }).transform(value => new Date(value));
export const scope = z.object({ workplaceId: uuid }).strict();
export const list = scope.extend({ take: z.coerce.number().int().min(1).max(100).default(25), skip: z.coerce.number().int().min(0).max(100000).default(0) });
export const money = z.union([z.string().regex(/^\d{1,7}(\.\d{1,2})?$/), z.number().finite().min(0).max(9999999.99).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7)]).transform(v => new Prisma.Decimal(v));
export const positiveMoney = money.refine(v => v.greaterThan(0), "Amount must be positive");
export const key = z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/);
export const id = () => randomUUID();
export const conflict = (message: string, code = "INVALID_TRANSITION") => new AppError(409, message, code);
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function replay<T extends { requestHash: string | null }>(record: T | null, hash: string): T | null {
  if (record && record.requestHash !== hash) throw conflict("Idempotency key was used with different input", "IDEMPOTENCY_CONFLICT");
  return record;
}
export function transition(current: string, next: string, graph: Record<string, readonly string[]>) {
  if (!graph[current]?.includes(next)) throw conflict(`Cannot move ${current} to ${next}`);
}
export function interval(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) throw new AppError(400, "End must be after start", "VALIDATION_ERROR");
}
export type Db = Prisma.TransactionClient;
export type Operation = { db: Db; context: RequestContext; params: Record<string, string> };
export const hospitalOperations: Array<{ path: string; method: string; permission: string; schema: z.ZodTypeAny }> = [];

export async function serializable<T>(operation: (db: Db) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 2) throw error;
    }
  }
}
export async function workplace(db: Db, context: RequestContext, workplaceId: string) {
  const row = await db.workplaces.findFirst({ where: { id: workplaceId, ...workplaceScope(context), status: "ACTIVE" } });
  if (!row) throw notFound("Workplace");
  return row;
}
export function workplaceScope(context: RequestContext): Prisma.workplacesWhereInput {
  return { tenantId: context.tenantId, ...(context.roles.includes("tenant_admin") ? {} : { siteId: { in: context.siteIds } }) };
}
export async function patient(db: Db, patientId: string, workplaceId: string) {
  const row = await db.patients.findFirst({ where: { id: patientId, patient_workplaces: { some: { workplaceId, status: "ACTIVE" } } } });
  if (!row) throw notFound("Patient");
  return row;
}
export async function doctor(db: Db, doctorId: string, workplaceId: string, context?: RequestContext) {
  const row = await db.doctor_profiles.findFirst({ where: { id: doctorId, doctor_workplaces: { some: { workplaceId, status: "ACTIVE" } } }, include: { user_accounts: true } });
  if (!row) throw notFound("Doctor");
  if (context && !context.permissions.includes("hms.clinical.manage") && row.user_accounts.authUserId !== context.userId) throw forbidden();
  return row;
}
export async function encounter(db: Db, encounterId: string, patientId: string, workplaceId: string) {
  const row = await db.encounters.findFirst({ where: { id: encounterId, patientId, workplaceId } });
  if (!row) throw notFound("Encounter");
  return row;
}

// The same registry mounts routes and documents their exact request schemas.
export function endpoint<S extends z.ZodTypeAny>(router: Router, method: "get" | "post" | "patch" | "delete" | "put", path: string, permission: string, schema: S, handler: (input: z.output<S>, op: Operation) => Promise<unknown>) {
  hospitalOperations.push({ path: `/hms${path.replace(/:([A-Za-z]+)/g, "{$1}")}`, method, permission, schema });
  const write = method !== "get";
  const paramNames = [...path.matchAll(/:([A-Za-z]+)/g)].map(match => match[1]!);
  const paramsSchema = z.object(Object.fromEntries(paramNames.map(name => [name, uuid]))).strict();
  router[method](path, requirePermission(permission), ...(write ? [rejectAuditorWrites] : []), validate({ [write ? "body" : "query"]: schema, params: paramsSchema }), asyncHandler(async (req, res) => {
    const input = (write ? req.body : req.query) as z.output<S>;
    const context = req.context!;
    const execute = async (db: Db) => {
      if (input && typeof input === "object" && "workplaceId" in input) await workplace(db, context, input.workplaceId);
      const data = await handler(input, { db, context, params: req.params as Record<string, string> });
      if (write) await db.auditEvent.create({ data: { tenantId: context.tenantId, entity: "HospitalOperation", entityId: req.params.id ?? (data && typeof data === "object" && "id" in data ? String(data.id) : "operation"), action: `${method.toUpperCase()} ${path}`, requestId: req.requestId, ipAddress: req.ip, afterState: { actorUserId: context.userId } } });
      return data;
    };
    const data = write ? await serializable(execute) : await execute(prisma);
    res.status(method === "post" ? 201 : 200).json({ data });
  }));
}
