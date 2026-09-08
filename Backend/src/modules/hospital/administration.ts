import { Router } from "express";
import { z } from "zod";
import { endpoint, scope, list, uuid, text, note, date, interval, transition, conflict } from "./common";
import { notFound } from "../../utils/errors";

export function administration(router: Router) {
  endpoint(router, "get", "/profile", "hms.read", scope, async (input, { db, context }) => db.hospitalProfile.findFirst({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId } }));
  endpoint(router, "put", "/profile", "hms.admin", scope.extend({ description: z.string().max(12000).default(""), phone: z.string().min(7).max(30).optional(), email: z.string().email().optional(), website: z.string().url().max(500).optional(), facilities: z.array(text).max(100).default([]), bookingSlotMinutes: z.number().int().min(5).max(120).default(20), cancellationWindowHours: z.number().int().min(0).max(168).default(24) }), async (input, { db, context }) => db.hospitalProfile.upsert({ where: { workplaceId: input.workplaceId }, create: { ...input, tenantId: context.tenantId }, update: input }));
  endpoint(router, "get", "/roster", "hms.care.read", list, async (input, { db, context }) => db.hospitalRoster.findMany({ where: { workplaceId: input.workplaceId, tenantId: context.tenantId }, take: input.take, skip: input.skip, orderBy: { startsAt: "asc" } }));
  endpoint(router, "post", "/roster", "hms.admin", scope.extend({ userId: z.string().min(1).max(100), startsAt: date, endsAt: date, role: z.enum(["NURSE", "RECEPTION", "BILLING", "PHARMACY", "OPERATIONS"]) }), async (input, { db, context }) => {
    interval(input.startsAt, input.endsAt);
    const workplace = await db.workplaces.findUniqueOrThrow({ where: { id: input.workplaceId } });
    if (!await db.tenantMembership.findFirst({ where: { tenantId: context.tenantId, userId: input.userId, user: { status: "ACTIVE" }, siteScopes: { some: { siteId: workplace.siteId ?? "__none__" } } } })) throw notFound("Active site member");
    if (await db.hospitalRoster.findFirst({ where: { userId: input.userId, status: "SCHEDULED", startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } } })) throw conflict("Staff member is already rostered", "SLOT_CONFLICT");
    return db.hospitalRoster.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "patch", "/roster/:id/status", "hms.admin", scope.extend({ status: z.enum(["COMPLETED", "CANCELLED"]) }), async (input, { db, params, context }) => {
    const row = await db.hospitalRoster.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Roster entry");
    transition(row.status, input.status, { SCHEDULED: ["COMPLETED", "CANCELLED"] }); return db.hospitalRoster.update({ where: { id: row.id }, data: { status: input.status } });
  });
  endpoint(router, "get", "/nursing/assignments", "hms.care.read", list, async (input, { db, context }) => db.nursingAssignment.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId, endedAt: null, ...(context.roles.includes("hospital_nurse") ? { userId: context.userId } : {}) }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/nursing/assignments", "hms.admin", scope.extend({ encounterId: uuid, userId: z.string().min(1).max(100) }), async (input, { db, context }) => {
    if (!await db.encounters.findFirst({ where: { id: input.encounterId, workplaceId: input.workplaceId, status: { notIn: ["CLOSED", "CANCELLED"] } } })) throw notFound("Active encounter");
    const workplace = await db.workplaces.findUniqueOrThrow({ where: { id: input.workplaceId } });
    if (!await db.tenantMembership.findFirst({ where: { tenantId: context.tenantId, userId: input.userId, user: { status: "ACTIVE" }, roles: { some: { role: { code: "hospital_nurse" } } }, siteScopes: { some: { siteId: workplace.siteId ?? "__none__" } } } })) throw notFound("Nurse with site access");
    if (await db.nursingAssignment.findFirst({ where: { encounterId: input.encounterId, userId: input.userId, endedAt: null } })) throw conflict("Nurse is already assigned");
    return db.nursingAssignment.create({ data: { ...input, tenantId: context.tenantId } });
  });
  endpoint(router, "post", "/nursing/assignments/:id/end", "hms.admin", scope, async (input, { db, params, context }) => {
    const row = await db.nursingAssignment.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Assignment");
    if (row.endedAt) return row; return db.nursingAssignment.update({ where: { id: row.id }, data: { endedAt: new Date() } });
  });
  endpoint(router, "get", "/content", "hms.read", list, async (input, { db, context }) => db.hospitalContent.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId, ...(context.permissions.includes("hms.admin") ? {} : { status: "PUBLISHED" }) }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/content", "hms.admin", scope.extend({ title: text, kind: z.enum(["ARTICLE", "PATIENT_EDUCATION", "VIDEO_LINK", "PROTOCOL"]), body: note }), async (input, { db, context }) => db.hospitalContent.create({ data: { ...input, tenantId: context.tenantId, authorUserId: context.userId } }));
  endpoint(router, "patch", "/content/:id", "hms.admin", scope.extend({ title: text.optional(), body: note.optional(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional() }), async ({ workplaceId, ...input }, { db, context, params }) => {
    const row = await db.hospitalContent.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId } }); if (!row) throw notFound("Content");
    if (row.status === "ARCHIVED") throw conflict("Archived content is immutable");
    return db.hospitalContent.update({ where: { id: row.id }, data: { ...input, ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}) } });
  });
  endpoint(router, "get", "/reviews", "hms.admin", list, async (input, { db, context }) => db.hospitalReview.findMany({ where: { tenantId: context.tenantId, workplaceId: input.workplaceId }, take: input.take, skip: input.skip, orderBy: { createdAt: "desc" } }));
  endpoint(router, "post", "/reviews", "hms.operations.write", scope.extend({ displayName: text, rating: z.number().int().min(1).max(5), comment: note }), async (input, { db, context }) => db.hospitalReview.create({ data: { ...input, tenantId: context.tenantId } }));
  endpoint(router, "post", "/reviews/:id/response", "hms.admin", scope.extend({ response: note }), async (input, { db, context, params }) => {
    const row = await db.hospitalReview.findFirst({ where: { id: params.id, tenantId: context.tenantId, workplaceId: input.workplaceId } }); if (!row) throw notFound("Review");
    return db.hospitalReview.update({ where: { id: row.id }, data: { response: input.response, respondedBy: context.userId, respondedAt: new Date() } });
  });
}
