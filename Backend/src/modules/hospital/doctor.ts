import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { requireAnyPermission, requirePermission, rejectAuditorWrites } from "../../middleware/authorize";
import { DEV_AUTH_USER_ID } from "../../middleware/protected";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { notFound } from "../../utils/errors";
import type { RequestContext } from "../../types/security";
import { endpoint, id, scope, transition } from "./common";

const workplaceQuery = z.object({ workplaceId: z.string().uuid().optional(), ensureDemo: z.coerce.boolean().optional() }).strict();
const stateInput = z.object({ scope: z.string().trim().min(1).max(100), entityId: z.string().trim().min(1).max(120), value: z.unknown(), workplaceId: z.string().uuid().optional() }).strict();
const stateParams = z.object({ scope: z.string().min(1).max(100), entityId: z.string().min(1).max(120) }).strict();
const messageInput = z.object({ conversationId: z.string().uuid().optional(), workplaceId: z.string().uuid().optional(), recipientUserAccountId: z.string().uuid().optional(), title: z.string().trim().min(1).max(500).optional(), body: z.string().trim().min(1).max(12000) }).strict();
const taskStatusInput = scope.extend({ status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]) });

async function currentUserAccount(context: RequestContext) {
  if (context.userId === DEV_AUTH_USER_ID) {
    return prisma.user_accounts.findUnique({ where: { email: "doctor@hospital.example" }, select: { id: true } });
  }
  return prisma.user_accounts.findUnique({ where: { authUserId: context.userId }, select: { id: true } });
}

async function resolveDoctorWorkplace(context: RequestContext, requestedWorkplaceId?: string) {
  const workplaces = await resolveDoctorWorkplaces(context);
  const row = requestedWorkplaceId
    ? workplaces.find((item) => item.id === requestedWorkplaceId)
    : workplaces[0];
  if (!row) throw notFound("Workplace");
  return row;
}

async function resolveDoctorWorkplaces(context: RequestContext) {
  const scope = context.roles.includes("tenant_admin") ? {} : { siteId: { in: context.siteIds } };
  const membership = context.roles.includes("tenant_admin")
    ? {}
    : { doctor_workplaces: { some: { status: "ACTIVE" as const, doctor_profiles: { user_accounts: { authUserId: context.userId } } } } };
  const where = { tenantId: context.tenantId, status: "ACTIVE" as const, ...scope, ...membership };
  return prisma.workplaces.findMany({ where, include: { workplace_locations: true }, orderBy: { createdAt: "asc" }, take: 100 });
}

function age(value: Date | null) {
  if (!value) return 0;
  const today = new Date();
  let result = today.getFullYear() - value.getFullYear();
  if (today.getMonth() < value.getMonth() || (today.getMonth() === value.getMonth() && today.getDate() < value.getDate())) result -= 1;
  return Math.max(result, 0);
}

export function doctor(router: Router) {
  router.get(
    "/doctor/bootstrap",
    requireAnyPermission("hms.clinical.read", "hms.clinical.write"),
    validate({ query: workplaceQuery }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplaces = await resolveDoctorWorkplaces(context);
      const requestedWorkplaceId = req.query.workplaceId as string | undefined;
      const workplace = requestedWorkplaceId
        ? workplaces.find((item) => item.id === requestedWorkplaceId)
        : workplaces[0];
      if (!workplace) throw notFound("Workplace");
      const workplaceIds = workplaces.map((item) => item.id);
      const currentAccount = await currentUserAccount(context);
      const taskVisibility = context.roles.includes("tenant_admin")
        ? {}
        : { OR: [{ task_assignees: { none: {} } }, ...(currentAccount ? [{ task_assignees: { some: { userAccountId: currentAccount.id } } }] : [])] };
      const [doctors, patients, appointments, shifts, services, diagnoses, prescriptions, orders, followUps, vitals, staff, notifications, tasks, admissions, encounters, currentDoctor] = await Promise.all([
        prisma.doctor_profiles.findMany({ where: { doctor_workplaces: { some: { workplaceId: { in: workplaceIds }, status: "ACTIVE" } } }, include: { doctor_workplaces: { where: { workplaceId: { in: workplaceIds } } } }, orderBy: { fullName: "asc" } }),
        prisma.patients.findMany({ where: { patient_workplaces: { some: { workplaceId: { in: workplaceIds }, status: "ACTIVE" } } }, include: { patient_workplaces: { where: { workplaceId: { in: workplaceIds } } }, patient_allergies: true, patient_conditions: true }, orderBy: { createdAt: "desc" }, take: 500 }),
        prisma.appointments.findMany({ where: { workplaceId: { in: workplaceIds } }, orderBy: { scheduledAt: "asc" }, take: 500 }),
        prisma.doctor_shifts.findMany({ where: { workplaceId: { in: workplaceIds } }, orderBy: { startsAt: "asc" }, take: 500 }),
        prisma.clinic_services.findMany({ where: { workplaceId: { in: workplaceIds }, isActive: true }, include: { clinic_service_doctors: { select: { doctorId: true } } }, orderBy: { name: "asc" }, take: 250 }),
        prisma.diagnoses.findMany({ where: { patients: { patient_workplaces: { some: { workplaceId: { in: workplaceIds }, status: "ACTIVE" } } } }, include: { encounters: { select: { workplaceId: true, doctorId: true } } }, orderBy: { diagnosedAt: "desc" }, take: 500 }),
        prisma.prescriptions.findMany({ where: { workplaceId: { in: workplaceIds } }, include: { prescription_medications: true }, orderBy: { createdAt: "desc" }, take: 500 }),
        prisma.investigation_orders.findMany({ where: { workplaceId: { in: workplaceIds } }, include: { reports: true }, orderBy: { orderedAt: "desc" }, take: 500 }),
        prisma.follow_ups.findMany({ where: { workplaceId: { in: workplaceIds } }, orderBy: { dueAt: "asc" }, take: 500 }),
        prisma.vital_sets.findMany({ where: { patients: { patient_workplaces: { some: { workplaceId: { in: workplaceIds }, status: "ACTIVE" } } } }, orderBy: { recordedAt: "desc" }, take: 500 }),
        prisma.staff_profiles.findMany({ where: { staff_workplaces: { some: { workplaceId: { in: workplaceIds }, status: "ACTIVE" } } }, include: { staff_workplaces: { where: { workplaceId: { in: workplaceIds } } }, user_accounts: { select: { id: true } } }, orderBy: { fullName: "asc" }, take: 250 }),
        prisma.notifications.findMany({ where: { workplaceId: { in: workplaceIds }, ...(currentAccount ? { OR: [{ recipientUserId: null }, { recipientUserId: currentAccount.id }] } : { recipientUserId: null }) }, orderBy: { createdAt: "desc" }, take: 250 }),
        prisma.tasks.findMany({ where: { workplaceId: { in: workplaceIds }, ...taskVisibility }, include: { task_assignees: { include: { user_accounts: { select: { email: true } } } } }, orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }], take: 250 }),
        prisma.hospitalAdmission.findMany({ where: { tenantId: context.tenantId, workplaceId: { in: workplaceIds }, status: "ADMITTED" }, include: { bed: true, encounters: { include: { diagnoses: { orderBy: { diagnosedAt: "desc" }, take: 3 } } } }, orderBy: { admittedAt: "desc" }, take: 250 }),
        prisma.encounters.findMany({ where: { workplaceId: { in: workplaceIds } }, orderBy: { createdAt: "desc" }, take: 500 }),
        prisma.doctor_profiles.findFirst({
          where: {
            user_accounts: context.userId === DEV_AUTH_USER_ID
              ? { email: "doctor@hospital.example" }
              : { authUserId: context.userId },
            doctor_workplaces: { some: { workplaceId: workplace.id, status: "ACTIVE" } },
          },
        }),
      ]);
      const locations = workplace.workplace_locations.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
      res.json({ data: {
        currentDoctorId: currentDoctor?.id,
        workplaceId: workplace.id,
        doctors,
        workplaces,
        locations,
        patients: patients.map((patient) => ({
          id: patient.id,
          fullName: patient.fullName,
          gender: patient.gender,
          dateOfBirth: patient.dateOfBirth,
          phone: patient.phone,
          email: patient.email,
          bloodGroup: patient.bloodGroup,
          primaryDoctorId: patient.primaryDoctorId,
          workplaces: patient.patient_workplaces.map((link) => ({ workplaceId: link.workplaceId, localMrn: link.localMrn })),
          allergies: patient.patient_allergies.map((allergy) => ({ substance: allergy.substance, severity: allergy.severity, reaction: allergy.reaction })),
          conditions: patient.patient_conditions.map((condition) => ({ name: condition.name })),
          age: age(patient.dateOfBirth),
        })),
        appointments,
        shifts,
        services: services.map((service) => ({ ...service, eligibleDoctors: service.clinic_service_doctors })),
        diagnoses,
        prescriptions,
        orders,
        followUps,
        vitals,
        staff,
        notifications,
        tasks,
        admissions,
        encounters,
      } });
    }),
  );

  endpoint(router, "patch", "/doctor/tasks/:id/status", "hms.clinical.write", taskStatusInput, async (input, { db, context, params }) => {
    const row = await db.tasks.findFirst({
      where: { id: params.id, workplaceId: input.workplaceId },
      include: { task_assignees: { include: { user_accounts: { select: { authUserId: true } } } } },
    });
    if (!row) throw notFound("Task");

    const hasAssignments = row.task_assignees.length > 0;
    const isAssignedToCaller = row.task_assignees.some((assignee) => assignee.user_accounts.authUserId === context.userId);
    if (hasAssignments && !isAssignedToCaller && context.userId !== DEV_AUTH_USER_ID && !context.roles.includes("tenant_admin")) {
      throw notFound("Task");
    }

    transition(row.status, input.status, { OPEN: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "CANCELLED"] });
    return db.tasks.update({
      where: { id: row.id },
      data: { status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : undefined, updatedAt: new Date() },
    });
  });

  router.get(
    "/doctor/state/:scope/:entityId",
    requireAnyPermission("hms.clinical.read", "hms.clinical.write"),
    validate({ params: stateParams, query: workplaceQuery }),
    asyncHandler(async (req, res) => {
      const workplace = await resolveDoctorWorkplace(req.context!, req.query.workplaceId as string | undefined);
      const row = await prisma.doctor_workspace_states.findUnique({ where: { tenantId_workplaceId_scope_entityId: { tenantId: req.context!.tenantId, workplaceId: workplace.id, scope: req.params.scope!, entityId: req.params.entityId! } } });
      res.json({ data: row });
    }),
  );

  router.post(
    "/doctor/state",
    requirePermission("hms.clinical.write"),
    rejectAuditorWrites,
    validate({ body: stateInput }),
    asyncHandler(async (req, res) => {
      const workplace = await resolveDoctorWorkplace(req.context!, req.body.workplaceId);
      const row = await prisma.doctor_workspace_states.upsert({
        where: { tenantId_workplaceId_scope_entityId: { tenantId: req.context!.tenantId, workplaceId: workplace.id, scope: req.body.scope, entityId: req.body.entityId } },
        create: { id: id(), tenantId: req.context!.tenantId, workplaceId: workplace.id, scope: req.body.scope, entityId: req.body.entityId, value: req.body.value },
        update: { value: req.body.value },
      });
      res.status(201).json({ data: row });
    }),
  );

  router.post(
    "/doctor/messages",
    requirePermission("hms.communication.write"),
    rejectAuditorWrites,
    validate({ body: messageInput }),
    asyncHandler(async (req, res) => {
      const context = req.context!;
      const workplace = await resolveDoctorWorkplace(context, req.body.workplaceId);
      const account = await currentUserAccount(context);
      if (!account) throw notFound("Doctor account");
      const doctorProfile = account ? await prisma.doctor_profiles.findUnique({ where: { userAccountId: account.id }, select: { fullName: true } }) : null;
      const recipientDoctor = req.body.recipientUserAccountId
        ? await prisma.doctor_profiles.findFirst({
            where: { userAccountId: req.body.recipientUserAccountId, doctor_workplaces: { some: { workplaceId: workplace.id, status: "ACTIVE" } } },
            select: { userAccountId: true, fullName: true },
          })
        : null;
      const recipientStaff = req.body.recipientUserAccountId && !recipientDoctor
        ? await prisma.staff_profiles.findFirst({
            where: { userAccountId: req.body.recipientUserAccountId, staff_workplaces: { some: { workplaceId: workplace.id, status: "ACTIVE" } } },
            select: { userAccountId: true, fullName: true, role: true },
          })
        : null;
      if (req.body.recipientUserAccountId && !recipientDoctor && !recipientStaff) throw notFound("Message recipient");

      const conversation = req.body.conversationId
        ? await prisma.conversations.findFirst({
            where: {
              id: req.body.conversationId,
              workplaceId: workplace.id,
              ...(!context.roles.includes("tenant_admin") ? { conversation_participants: { some: { userAccountId: account.id } } } : {}),
            },
          })
        : req.body.recipientUserAccountId
          ? await prisma.conversations.findFirst({
              where: {
                workplaceId: workplace.id,
                conversation_participants: { some: { userAccountId: account.id } },
                AND: [{ conversation_participants: { some: { userAccountId: req.body.recipientUserAccountId } } }],
              },
            })
          : null;
      if (req.body.conversationId && !conversation) throw notFound("Conversation");
      const existingConversation = conversation;
      const targetName = recipientDoctor?.fullName ?? recipientStaff?.fullName;
      const targetType = recipientDoctor
        ? "Doctor"
        : recipientStaff?.role === "NURSE"
          ? "Nurse"
          : recipientStaff?.role === "PHARMACIST"
            ? "Pharmacist"
            : recipientStaff?.role === "TECHNICIAN"
              ? "Lab"
              : "Clinic Admin";
      const createdConversation = existingConversation ?? await prisma.conversations.create({
        data: {
          id: id(),
          workplaceId: workplace.id,
          type: recipientDoctor ? "DOCTOR" : "CLINIC_STAFF",
          title: req.body.title ?? targetName ?? "Doctor workspace",
          updatedAt: new Date(),
          conversation_participants: {
            create: [
              { id: id(), displayName: doctorProfile?.fullName ?? "Doctor", participantType: "Doctor", userAccountId: account.id },
              ...(req.body.recipientUserAccountId && req.body.recipientUserAccountId !== account.id
                ? [{ id: id(), displayName: targetName ?? "Care team", participantType: targetType, userAccountId: req.body.recipientUserAccountId }]
                : []),
            ],
          },
        },
      });
      const message = await prisma.messages.create({ data: { id: id(), conversationId: createdConversation.id, senderUserId: account.id, body: req.body.body } });
      await prisma.conversations.update({ where: { id: createdConversation.id }, data: { updatedAt: new Date() } });
      res.status(201).json({ data: { conversationId: createdConversation.id, message } });
    }),
  );
}
