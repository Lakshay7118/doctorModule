import { Router } from "express";
import { z } from "zod";
import { endpoint, scope, list, uuid, text, id, money, workplaceScope, patient, doctor, conflict } from "./common";
import { notFound } from "../../utils/errors";

export function management(router: Router) {
  endpoint(router, "get", "/workplaces", "hms.read", z.object({}).strict(), async (_, { db, context }) => db.workplaces.findMany({ where: workplaceScope(context), include: { workplace_locations: true }, take: 100 }));
  endpoint(router, "post", "/workplaces", "hms.admin", z.object({ name: text, legalName: text.optional(), type: z.enum(["SOLO_PRACTICE", "CLINIC", "HOSPITAL", "ONLINE_PRACTICE"]), siteId: z.string().min(1).max(100), timeZone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }).default("Asia/Kolkata") }).strict(), async (input, { db, context }) => {
    if (!await db.site.findFirst({ where: { id: input.siteId, tenantId: context.tenantId } })) throw notFound("Site");
    return db.workplaces.create({ data: { id: id(), ...input, tenantId: context.tenantId, updatedAt: new Date() } });
  });
  endpoint(router, "get", "/locations", "hms.read", list, async (input, { db }) => db.workplace_locations.findMany({ where: { workplaceId: input.workplaceId }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/locations", "hms.admin", scope.extend({ name: text, addressLine1: text, city: text, state: text.optional(), postalCode: text.optional(), isPrimary: z.boolean().default(false) }), async (input, { db }) => {
    if (input.isPrimary) await db.workplace_locations.updateMany({ where: { workplaceId: input.workplaceId }, data: { isPrimary: false, updatedAt: new Date() } });
    return db.workplace_locations.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "patch", "/locations/:id", "hms.admin", scope.extend({ name: text.optional(), addressLine1: text.optional(), city: text.optional(), state: text.optional(), postalCode: text.optional(), isPrimary: z.boolean().optional() }), async ({ workplaceId, isPrimary, ...data }, { db, params }) => {
    if (!await db.workplace_locations.findFirst({ where: { id: params.id, workplaceId } })) throw notFound("Location");
    if (isPrimary) await db.workplace_locations.updateMany({ where: { workplaceId }, data: { isPrimary: false, updatedAt: new Date() } });
    return db.workplace_locations.update({ where: { id: params.id }, data: { ...data, isPrimary, updatedAt: new Date() } });
  });
  endpoint(router, "delete", "/locations/:id", "hms.admin", scope, async ({ workplaceId }, { db, params }) => {
    if (!await db.workplace_locations.findFirst({ where: { id: params.id, workplaceId } })) throw notFound("Location");
    return db.workplace_locations.delete({ where: { id: params.id } });
  });
  endpoint(router, "get", "/doctors", "hms.read", list, async (input, { db }) => db.doctor_profiles.findMany({ where: { doctor_workplaces: { some: { workplaceId: input.workplaceId, status: "ACTIVE" } } }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/doctors", "hms.admin", scope.extend({ userId: z.string().min(1).max(100), fullName: text, specialty: text, qualifications: text.optional(), experienceYears: z.number().int().min(0).max(80).optional() }), async (input, { db, context }) => {
    const member = await db.tenantMembership.findFirst({ where: { tenantId: context.tenantId, userId: input.userId }, include: { user: true } });
    if (!member) throw notFound("Member");
    const account = await db.user_accounts.upsert({ where: { authUserId: input.userId }, create: { id: id(), authUserId: input.userId, email: member.user.email, updatedAt: new Date() }, update: {} });
    const profile = await db.doctor_profiles.upsert({ where: { userAccountId: account.id }, create: { id: id(), userAccountId: account.id, fullName: input.fullName, specialty: input.specialty, qualifications: input.qualifications, experienceYears: input.experienceYears, updatedAt: new Date() }, update: {} });
    await db.doctor_workplaces.upsert({ where: { doctorId_workplaceId: { doctorId: profile.id, workplaceId: input.workplaceId } }, create: { id: id(), doctorId: profile.id, workplaceId: input.workplaceId, doctorRole: "CONSULTANT", updatedAt: new Date() }, update: { status: "ACTIVE", updatedAt: new Date() } });
    return profile;
  });
  endpoint(router, "patch", "/doctors/:id", "hms.admin", scope.extend({ fullName: text.optional(), specialty: text.optional(), qualifications: text.optional(), experienceYears: z.number().int().min(0).max(80).optional() }), async ({ workplaceId, ...data }, { db, params }) => {
    const membership = await db.doctor_workplaces.findFirst({ where: { doctorId: params.id, workplaceId, status: "ACTIVE" } });
    if (!membership) throw notFound("Doctor");
    return db.doctor_profiles.update({ where: { id: params.id }, data: { ...data, updatedAt: new Date() } });
  });
  endpoint(router, "delete", "/doctors/:id", "hms.admin", scope, async ({ workplaceId }, { db, params }) => {
    const membership = await db.doctor_workplaces.findFirst({ where: { doctorId: params.id, workplaceId, status: "ACTIVE" } });
    if (!membership) throw notFound("Doctor");
    return db.doctor_workplaces.update({ where: { id: membership.id }, data: { status: "ARCHIVED", updatedAt: new Date() } });
  });
  endpoint(router, "get", "/staff", "hms.admin", list, async (input, { db }) => db.staff_profiles.findMany({ where: { staff_workplaces: { some: { workplaceId: input.workplaceId } } }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/staff", "hms.admin", scope.extend({ fullName: text, role: z.enum(["RECEPTIONIST", "NURSE", "BILLING", "PHARMACIST", "TECHNICIAN", "SUPPORT"]) }), async (input, { db }) => db.staff_profiles.create({ data: { id: id(), fullName: input.fullName, role: input.role, updatedAt: new Date(), staff_workplaces: { create: { id: id(), workplaceId: input.workplaceId, role: input.role, updatedAt: new Date() } } } }));
  endpoint(router, "patch", "/staff/:id", "hms.admin", scope.extend({ fullName: text.optional(), role: z.enum(["RECEPTIONIST", "NURSE", "BILLING", "PHARMACIST", "TECHNICIAN", "SUPPORT"]).optional(), status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "ARCHIVED"]).optional() }), async ({ workplaceId, status, ...data }, { db, params }) => {
    const membership = await db.staff_workplaces.findFirst({ where: { staffId: params.id, workplaceId } });
    if (!membership) throw notFound("Staff member");
    await db.staff_workplaces.update({ where: { id: membership.id }, data: { ...(status ? { status } : {}), ...(data.role ? { role: data.role } : {}), updatedAt: new Date() } });
    return db.staff_profiles.update({ where: { id: params.id }, data: { ...data, updatedAt: new Date() } });
  });
  endpoint(router, "delete", "/staff/:id", "hms.admin", scope, async ({ workplaceId }, { db, params }) => {
    const membership = await db.staff_workplaces.findFirst({ where: { staffId: params.id, workplaceId } });
    if (!membership) throw notFound("Staff member");
    return db.staff_workplaces.update({ where: { id: membership.id }, data: { status: "ARCHIVED", updatedAt: new Date() } });
  });
  endpoint(router, "get", "/services", "hms.read", list, async (input, { db }) => db.clinic_services.findMany({ where: { workplaceId: input.workplaceId }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/services", "hms.admin", scope.extend({ name: text, description: text.optional(), durationMinutes: z.number().int().min(5).max(480).default(20), price: money, eligibleDoctorIds: z.array(uuid).max(100).default([]) }), async ({ workplaceId, eligibleDoctorIds, ...input }, { db }) => {
    for (const doctorId of eligibleDoctorIds) await doctor(db, doctorId, workplaceId);
    return db.clinic_services.create({ data: { ...input, workplaceId, id: id(), updatedAt: new Date(), clinic_service_doctors: { create: eligibleDoctorIds.map((doctorId) => ({ id: id(), doctorId })) } }, include: { clinic_service_doctors: true } });
  });
  endpoint(router, "patch", "/services/:id", "hms.admin", scope.extend({ name: text.optional(), description: text.optional(), durationMinutes: z.number().int().min(5).max(480).optional(), price: money.optional(), isActive: z.boolean().optional(), eligibleDoctorIds: z.array(uuid).max(100).optional() }), async ({ workplaceId, eligibleDoctorIds, ...data }, { db, params }) => {
    if (!await db.clinic_services.findFirst({ where: { id: params.id, workplaceId } })) throw notFound("Service");
    if (eligibleDoctorIds) {
      for (const doctorId of eligibleDoctorIds) await doctor(db, doctorId, workplaceId);
      await db.clinic_service_doctors.deleteMany({ where: { serviceId: params.id } });
    }
    return db.clinic_services.update({ where: { id: params.id }, data: { ...data, ...(eligibleDoctorIds ? { clinic_service_doctors: { create: eligibleDoctorIds.map((doctorId) => ({ id: id(), doctorId })) } } : {}), updatedAt: new Date() }, include: { clinic_service_doctors: true } });
  });
  endpoint(router, "delete", "/services/:id", "hms.admin", scope, async ({ workplaceId }, { db, params }) => {
    if (!await db.clinic_services.findFirst({ where: { id: params.id, workplaceId } })) throw notFound("Service");
    return db.clinic_services.update({ where: { id: params.id }, data: { isActive: false, updatedAt: new Date() } });
  });
  endpoint(router, "get", "/rooms", "hms.read", list, async (input, { db }) => db.clinic_rooms.findMany({ where: { workplaceId: input.workplaceId }, take: input.take, skip: input.skip }));
  endpoint(router, "post", "/rooms", "hms.admin", scope.extend({ name: text, roomType: z.enum(["Consultation", "OT", "Procedure", "Imaging"]), locationId: uuid.optional() }), async (input, { db }) => {
    if (input.locationId && !await db.workplace_locations.findFirst({ where: { id: input.locationId, workplaceId: input.workplaceId } })) throw notFound("Location");
    return db.clinic_rooms.create({ data: { ...input, id: id(), updatedAt: new Date() } });
  });
  endpoint(router, "get", "/patients", "hms.patients.read", list.extend({ search: z.string().max(120).optional() }), async (input, { db }) => db.patients.findMany({ where: { patient_workplaces: { some: { workplaceId: input.workplaceId, status: "ACTIVE" } }, ...(input.search ? { OR: [{ fullName: { contains: input.search, mode: "insensitive" } }, { qlynoId: { contains: input.search, mode: "insensitive" } }, { phone: { contains: input.search } }] } : {}) }, take: input.take, skip: input.skip, orderBy: { createdAt: "desc" } }));
  endpoint(router, "get", "/patients/:id", "hms.patients.read", scope, async (input, { db, params }) => patient(db, params.id!, input.workplaceId));
  endpoint(router, "post", "/patients", "hms.patients.write", scope.extend({ qlynoId: text.optional(), fullName: text, gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]), phone: z.string().min(5).max(30).optional(), dateOfBirth: z.string().date().optional(), email: z.string().email().optional(), bloodGroup: z.string().max(10).optional(), primaryDoctorId: uuid.optional(), localMrn: text.optional() }), async ({ workplaceId, localMrn, dateOfBirth, qlynoId, primaryDoctorId, ...input }, { db }) => {
    if (dateOfBirth && new Date(dateOfBirth) > new Date()) throw conflict("Birth date cannot be in the future");
    if (primaryDoctorId) await doctor(db, primaryDoctorId, workplaceId);
    return db.patients.create({ data: { ...input, primaryDoctorId, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined, id: id(), qlynoId: qlynoId ?? `QL-${id()}`, updatedAt: new Date(), patient_workplaces: { create: { id: id(), workplaceId, localMrn, updatedAt: new Date() } } }, include: { patient_workplaces: true, patient_allergies: true, patient_conditions: true } });
  });
  endpoint(router, "patch", "/patients/:id", "hms.patients.write", scope.extend({ phone: z.string().min(5).max(30).optional(), email: z.string().email().optional(), fullName: text.optional(), gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).optional(), dateOfBirth: z.string().date().nullable().optional(), bloodGroup: z.string().max(10).optional(), primaryDoctorId: uuid.optional() }), async ({ workplaceId, primaryDoctorId, dateOfBirth, ...input }, { db, params }) => {
    await patient(db, params.id!, workplaceId);
    if (primaryDoctorId) await doctor(db, primaryDoctorId, workplaceId);
    return db.patients.update({ where: { id: params.id }, data: { ...input, primaryDoctorId, dateOfBirth: dateOfBirth === null ? null : dateOfBirth ? new Date(dateOfBirth) : undefined, updatedAt: new Date() }, include: { patient_workplaces: true, patient_allergies: true, patient_conditions: true } });
  });
  endpoint(router, "delete", "/patients/:id", "hms.patients.write", scope, async ({ workplaceId }, { db, params }) => {
    await patient(db, params.id!, workplaceId);
    return db.patient_workplaces.update({ where: { patientId_workplaceId: { patientId: params.id!, workplaceId } }, data: { status: "ARCHIVED", updatedAt: new Date() } });
  });
}
