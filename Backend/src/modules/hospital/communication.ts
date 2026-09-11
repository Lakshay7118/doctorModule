import { Router } from "express";
import { z } from "zod";
import { DEV_AUTH_USER_ID } from "../../middleware/protected";
import { endpoint, scope, list, text, note, id, uuid, patient, Db } from "./common";
import { notFound } from "../../utils/errors";

async function account(db: Db, userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return db.user_accounts.upsert({ where: { authUserId: user.id }, create: { id: id(), authUserId: user.id, email: user.email, updatedAt: new Date() }, update: {} });
}

async function accountForContext(db: Db, userId: string) {
  if (userId === DEV_AUTH_USER_ID) {
    return db.user_accounts.findUnique({ where: { email: "doctor@hospital.example" } });
  }
  return db.user_accounts.findUnique({ where: { authUserId: userId } });
}

function serializeConversation(row: {
  id: string;
  type: string;
  workplaceId: string | null;
  patientId: string | null;
  referralId: string | null;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  conversation_participants: Array<{ id: string; displayName: string; participantType: string; userAccountId: string | null; lastReadAt: Date | null; createdAt: Date }>;
  messages: Array<{ id: string; conversationId: string; senderUserId: string | null; body: string; attachmentUrl: string | null; sentAt: Date; createdAt: Date }>;
}, selfAccountId?: string) {
  return {
    id: row.id,
    type: row.type,
    workplaceId: row.workplaceId,
    patientId: row.patientId,
    referralId: row.referralId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    participants: row.conversation_participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      participantType: participant.participantType,
      userAccountId: participant.userAccountId,
      lastReadAt: participant.lastReadAt,
      createdAt: participant.createdAt,
      isSelf: Boolean(selfAccountId && participant.userAccountId === selfAccountId),
    })),
    messages: row.messages.map((message) => ({
      ...message,
      isMine: Boolean(selfAccountId && message.senderUserId === selfAccountId),
    })),
  };
}

export function communication(router: Router) {
  endpoint(router, "get", "/notifications", "hms.read", list, async (input, { db, context }) => db.notifications.findMany({ where: { workplaceId: input.workplaceId, user_accounts: { authUserId: context.userId } }, take: input.take, skip: input.skip, orderBy: { createdAt: "desc" } }));
  endpoint(router, "post", "/notifications/:id/read", "hms.read", scope, async (input, { db, params, context }) => {
    const row = await db.notifications.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, user_accounts: { authUserId: context.userId } } }); if (!row) throw notFound("Notification");
    return db.notifications.update({ where: { id: row.id }, data: { readAt: row.readAt ?? new Date() } });
  });
  endpoint(router, "get", "/conversations", "hms.communication.write", list, async (input, { db, context }) => {
    const self = await accountForContext(db, context.userId);
    if (!self) return [];
    const rows = await db.conversations.findMany({
      where: { workplaceId: input.workplaceId, conversation_participants: { some: { userAccountId: self.id } } },
      include: { conversation_participants: true, messages: { orderBy: { sentAt: "asc" }, take: 50 } },
      take: input.take,
      skip: input.skip,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => serializeConversation(row, self.id));
  });
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
    const self = await accountForContext(db, context.userId);
    if (!self || !await db.conversations.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, conversation_participants: { some: { userAccountId: self.id } } } })) throw notFound("Conversation");
    return db.messages.findMany({ where: { conversationId: params.id }, take: input.take, skip: input.skip, orderBy: { sentAt: "desc" } });
  });
  endpoint(router, "post", "/conversations/:id/messages", "hms.communication.write", scope.extend({ body: note }), async (input, { db, context, params }) => {
    const self = await accountForContext(db, context.userId);
    if (!self || !await db.conversations.findFirst({ where: { id: params.id, workplaceId: input.workplaceId, conversation_participants: { some: { userAccountId: self.id } } } })) throw notFound("Conversation");
    await db.conversations.update({ where: { id: params.id }, data: { updatedAt: new Date() } });
    return db.messages.create({ data: { id: id(), conversationId: params.id!, senderUserId: self.id, body: input.body } });
  });
}
