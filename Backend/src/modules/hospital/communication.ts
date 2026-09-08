import { Router } from "express";
import { z } from "zod";
import { endpoint, scope, list, text, note, id, uuid, patient, Db } from "./common";
import { notFound } from "../../utils/errors";

async function account(db: Db, userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return db.user_accounts.upsert({ where: { authUserId: user.id }, create: { id: id(), authUserId: user.id, email: user.email, updatedAt: new Date() }, update: {} });
}
export function communication(router: Router) {
  endpoint(router, "get", "/notifications", "hms.read", list, async (input, { db, context }) => db.notifications.findMany({ where: { workplaceId: input.workplaceId, user_accounts: { authUserId: context.userId } }, take: input.take, skip: input.skip, orderBy: { createdAt: "desc" } }));
  endpoint(router, "post", "/notifications/:id/read", "hms.read", scope, async (input, { db, params, context }) => {
    const row = await db.notifications.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, user_accounts: { authUserId: context.userId } } }); if (!row) throw notFound("Notification");
    return db.notifications.update({ where: { id: row.id }, data: { readAt: row.readAt ?? new Date() } });
  });
  endpoint(router, "get", "/conversations", "hms.communication.write", list, async (input, { db, context }) => db.conversations.findMany({ where: { workplaceId: input.workplaceId, conversation_participants: { some: { userAccountId: (await db.user_accounts.findUnique({ where: { authUserId: context.userId } }))?.id ?? "00000000-0000-4000-8000-000000000000" } } }, take: input.take, skip: input.skip, orderBy: { updatedAt: "desc" } }));
  endpoint(router, "post", "/conversations", "hms.communication.write", scope.extend({ title: text, patientId: uuid.optional(), participantUserIds: z.array(z.string().min(1).max(100)).min(1).max(20) }), async (input, { db, context }) => {
    if (input.patientId) await patient(db, input.patientId, input.workplaceId);
    const workplace = await db.workplaces.findUniqueOrThrow({ where: { id: input.workplaceId } });
    const userIds = [...new Set([...input.participantUserIds, context.userId])];
    const members = await db.tenantMembership.findMany({ where: { tenantId: context.tenantId, userId: { in: userIds }, user: { status: "ACTIVE" }, siteScopes: { some: { siteId: workplace.siteId ?? "__none__" } } }, include: { user: true } });
    if (members.length !== userIds.length) throw notFound("Participant with site access");
    const participants = [];
    for (const member of members) participants.push({ id: id(), displayName: member.user.name, participantType: "STAFF", userAccountId: (await account(db, member.userId)).id });
    return db.conversations.create({ data: { id: id(), workplaceId: input.workplaceId, patientId: input.patientId, title: input.title, type: "CLINIC_STAFF", updatedAt: new Date(), conversation_participants: { create: participants } } });
  });
  endpoint(router, "get", "/conversations/:id/messages", "hms.communication.write", list, async (input, { db, context, params }) => {
    const self = await db.user_accounts.findUnique({ where: { authUserId: context.userId } });
    if (!self || !await db.conversations.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, conversation_participants: { some: { userAccountId: self.id } } } })) throw notFound("Conversation");
    return db.messages.findMany({ where: { conversationId: params.id }, take: input.take, skip: input.skip, orderBy: { sentAt: "desc" } });
  });
  endpoint(router, "post", "/conversations/:id/messages", "hms.communication.write", scope.extend({ body: note }), async (input, { db, context, params }) => {
    const self = await db.user_accounts.findUnique({ where: { authUserId: context.userId } });
    if (!self || !await db.conversations.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, conversation_participants: { some: { userAccountId: self.id } } } })) throw notFound("Conversation");
    await db.conversations.update({ where: { id: params.id }, data: { updatedAt: new Date() } });
    return db.messages.create({ data: { id: id(), conversationId: params.id!, senderUserId: self.id, body: input.body } });
  });
}
