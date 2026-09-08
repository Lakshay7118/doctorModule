import type { Request, Response } from "express";
import type { Prisma, TenantMembership } from "../../generated/prisma";
import { prisma } from "../../db/prisma";
import { getEnv } from "../../config/env";
import { permissionsForRoles, EXTERNAL_ROLES, INTERNAL_ROLES, type SystemRole } from "../../config/permissions";
import { AppError, forbidden, unauthorized } from "../../utils/errors";
import { hashIdentifier, hashOpaqueToken, hashPassword, randomToken, verifyPassword } from "../../utils/hashing";
import { signAccessToken } from "../../utils/tokens";
import type { AuthenticatedUser } from "../../types/security";

const LOCK_THRESHOLD = 5; const LOCK_MS = 15 * 60_000;
type MembershipWithAccess = Prisma.TenantMembershipGetPayload<{ include: { user: true; roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }; siteScopes: true; departmentScopes: true } }>;

export function toAuthUser(membership: MembershipWithAccess): AuthenticatedUser {
  const roles = membership.roles.map((entry) => entry.role.code);
  const permissions = [...new Set([...permissionsForRoles(roles), ...membership.roles.flatMap((entry) => entry.role.permissions.map((permission) => permission.permission.code))])];
  return { userId: membership.userId, membershipId: membership.id, tenantId: membership.tenantId, status: membership.user.status, roles, permissions, siteIds: membership.siteScopes.map((scope) => scope.siteId), departmentIds: membership.departmentScopes.map((scope) => scope.departmentId), clientOrganizationId: membership.clientOrganizationId ?? undefined, practitionerId: membership.practitionerId ?? undefined };
}

async function loadMembership(id: string): Promise<MembershipWithAccess> {
  const membership = await prisma.tenantMembership.findUnique({ where: { id }, include: { user: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }, siteScopes: true, departmentScopes: true } });
  if (!membership) throw unauthorized(); return membership;
}

function cookieOptions() { const env = getEnv(); return { httpOnly: true, secure: env.COOKIE_SECURE === "true", sameSite: "strict" as const, path: "/api/auth", maxAge: env.REFRESH_TOKEN_DAYS * 86_400_000 }; }
export function setRefreshCookie(res: Response, token: string): void { res.cookie("qlyno_refresh", token, cookieOptions()); }
export function clearRefreshCookie(res: Response): void { res.clearCookie("qlyno_refresh", cookieOptions()); }

async function createRefreshSession(user: AuthenticatedUser, req: Request, familyId = randomToken(18)): Promise<string> {
  const raw = randomToken(); const env = getEnv(); await prisma.refreshSession.create({ data: { tenantId: user.tenantId, userId: user.userId, familyId, tokenHash: hashOpaqueToken(raw), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000), ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } }); return raw;
}

export async function login(input: { identifier: string; password: string; tenantSlug: string }, req: Request): Promise<{ accessToken: string; refreshToken: string; user: AuthenticatedUser }> {
  const identifier = input.identifier.trim().toLowerCase(); const env = getEnv();
  if (env.NODE_ENV === "development" && env.AUTH_DISABLED) {
    const roleByIdentifier: Record<string, SystemRole[]> = {
      "doctor@hospital.example": ["hospital_doctor"],
      "reception@hospital.example": ["hospital_receptionist"],
      "nurse@hospital.example": ["hospital_nurse"],
      "billing@hospital.example": ["hospital_billing"],
      "operations@hospital.example": ["hospital_operations"],
    };
    const roles = roleByIdentifier[identifier] ?? ["tenant_admin"];
    const user: AuthenticatedUser = {
      userId: `DEV-${identifier.replace(/[^a-z0-9]+/g, "-").toUpperCase()}`,
      membershipId: "DEV-MEMBERSHIP",
      tenantId: "TEN-SUNRISE",
      status: "ACTIVE",
      roles,
      permissions: permissionsForRoles(roles),
      siteIds: ["SITE-01"],
      departmentIds: ["DEPT-HEMA", "DEPT-CHEM", "DEPT-01", "DEPT-02", "DEPT-03", "DEPT-05"],
    };
    return { accessToken: signAccessToken(user), refreshToken: randomToken(), user };
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug.toLowerCase() } });
  const user = tenant ? await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }], memberships: { some: { tenantId: tenant.id } } } }) : null;
  const attemptBase = { tenantId: tenant?.id, userId: user?.id, identifierHash: hashIdentifier(`${input.tenantSlug}:${identifier}`), ipAddress: req.ip || "unknown" };
  if (!user || !user.passwordHash) { await prisma.authenticationAttempt.create({ data: { ...attemptBase, success: false, reason: "INVALID_CREDENTIALS" } }); throw unauthorized(); }
  if (user.lockedUntil && user.lockedUntil > new Date()) { await prisma.authenticationAttempt.create({ data: { ...attemptBase, success: false, reason: "LOCKED" } }); throw new AppError(423, "Account temporarily locked", "ACCOUNT_LOCKED"); }
  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) { const failures = user.failedLoginCount + 1; await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: failures, lockedUntil: failures >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MS) : null } }), prisma.authenticationAttempt.create({ data: { ...attemptBase, success: false, reason: "INVALID_CREDENTIALS" } })]); throw unauthorized(); }
  if (user.status === "PENDING_APPROVAL") throw new AppError(403, "Account is awaiting approval", "AWAITING_APPROVAL");
  if (user.status !== "ACTIVE") throw forbidden();
  const membership = await prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId: tenant!.id, userId: user.id } }, include: { user: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }, siteScopes: true, departmentScopes: true } });
  if (!membership) throw unauthorized(); await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } }), prisma.authenticationAttempt.create({ data: { ...attemptBase, success: true } })]);
  const authUser = toAuthUser(membership); const refreshToken = await createRefreshSession(authUser, req); return { accessToken: signAccessToken(authUser), refreshToken, user: authUser };
}

export async function registerExternal(input: { tenantSlug: string; email: string; username?: string; name: string; password: string; requestedRole: SystemRole; clientOrganizationId?: string; practitionerId?: string }): Promise<{ userId: string; status: string }> {
  if (INTERNAL_ROLES.includes(input.requestedRole) || !EXTERNAL_ROLES.includes(input.requestedRole)) throw forbidden();
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug.toLowerCase() } }); if (!tenant) throw new AppError(400, "Invalid registration", "INVALID_REGISTRATION");
  if (input.requestedRole === "client_lab_user" && !input.clientOrganizationId) throw new AppError(400, "Client organization is required", "VALIDATION_ERROR");
  if (input.requestedRole === "referring_clinician" && !input.practitionerId) throw new AppError(400, "Practitioner is required", "VALIDATION_ERROR");
  if (input.clientOrganizationId && !await prisma.clientOrganization.findFirst({ where: { id: input.clientOrganizationId, tenantId: tenant.id } })) throw new AppError(400, "Invalid registration", "INVALID_REGISTRATION");
  if (input.practitionerId && !await prisma.practitioner.findFirst({ where: { id: input.practitionerId, tenantId: tenant.id } })) throw new AppError(400, "Invalid registration", "INVALID_REGISTRATION");
  const role = await prisma.role.findFirst({ where: { code: input.requestedRole, OR: [{ tenantId: tenant.id }, { tenantId: null }] } }); if (!role) throw new AppError(400, "Invalid registration", "INVALID_REGISTRATION");
  const passwordHash = await hashPassword(input.password);
  const created = await prisma.$transaction(async (tx) => { const user = await tx.user.create({ data: { email: input.email.toLowerCase(), username: input.username?.toLowerCase(), name: input.name, passwordHash, status: "PENDING_APPROVAL" } }); const membership = await tx.tenantMembership.create({ data: { tenantId: tenant.id, userId: user.id, clientOrganizationId: input.clientOrganizationId, practitionerId: input.practitionerId, roles: { create: { tenantId: tenant.id, roleId: role.id } } } }); await tx.approvalRequest.create({ data: { tenantId: tenant.id, subjectUserId: user.id, requestedRole: input.requestedRole, status: "PENDING" } }); return { user, membership }; });
  return { userId: created.user.id, status: created.user.status };
}

export async function completeInvite(input: { token: string; name: string; username?: string; password: string }): Promise<{ userId: string; status: string }> {
  const tokenHash = hashOpaqueToken(input.token); const invitation = await prisma.userInvitation.findUnique({ where: { tokenHash } }); if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) throw new AppError(400, "Invitation is invalid or expired", "INVALID_INVITATION");
  const user = await prisma.user.findFirst({ where: { email: invitation.email.toLowerCase(), memberships: { some: { tenantId: invitation.tenantId } } } }); if (!user || user.status !== "PENDING_INVITE") throw new AppError(400, "Invitation is invalid or expired", "INVALID_INVITATION");
  const passwordHash = await hashPassword(input.password); const updated = await prisma.$transaction(async (tx) => { const result = await tx.user.update({ where: { id: user.id }, data: { name: input.name, username: input.username?.toLowerCase(), passwordHash, status: "ACTIVE", passwordChangedAt: new Date() } }); await tx.userInvitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } }); return result; }); return { userId: updated.id, status: updated.status };
}

export async function rotateRefreshToken(raw: string | undefined, req: Request): Promise<{ accessToken: string; refreshToken: string; user: AuthenticatedUser }> {
  if (!raw) throw unauthorized(); const tokenHash = hashOpaqueToken(raw); const current = await prisma.refreshSession.findUnique({ where: { tokenHash } }); if (!current) throw unauthorized();
  if (current.revokedAt || current.replacedByTokenHash) { await prisma.refreshSession.updateMany({ where: { familyId: current.familyId, userId: current.userId }, data: { revokedAt: new Date() } }); throw unauthorized(); }
  if (current.expiresAt <= new Date()) throw unauthorized(); const membership = await prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId: current.tenantId, userId: current.userId } }, include: { user: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }, siteScopes: true, departmentScopes: true } }); if (!membership || membership.user.status !== "ACTIVE") throw forbidden();
  const user = toAuthUser(membership); const nextRaw = randomToken(); const nextHash = hashOpaqueToken(nextRaw); const env = getEnv(); await prisma.$transaction([prisma.refreshSession.update({ where: { id: current.id }, data: { revokedAt: new Date(), replacedByTokenHash: nextHash } }), prisma.refreshSession.create({ data: { tenantId: current.tenantId, userId: current.userId, familyId: current.familyId, tokenHash: nextHash, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000), ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) } })]); return { accessToken: signAccessToken(user), refreshToken: nextRaw, user };
}

export async function logout(raw: string | undefined): Promise<void> { if (raw) await prisma.refreshSession.updateMany({ where: { tokenHash: hashOpaqueToken(raw), revokedAt: null }, data: { revokedAt: new Date() } }); }
export async function logoutAll(userId: string): Promise<void> { await prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); }
export async function forgotPassword(email: string, tenantSlug: string): Promise<string | undefined> { const membership = await prisma.tenantMembership.findFirst({ where: { tenant: { slug: tenantSlug.toLowerCase() }, user: { email: email.toLowerCase() } }, include: { user: true } }); if (!membership || membership.user.status !== "ACTIVE") return; const raw = randomToken(); await prisma.passwordResetToken.create({ data: { tenantId: membership.tenantId, userId: membership.userId, tokenHash: hashOpaqueToken(raw), expiresAt: new Date(Date.now() + 30 * 60_000) } }); return raw; }
export async function resetPassword(raw: string, password: string): Promise<void> { const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(raw) } }); if (!token || token.usedAt || token.expiresAt <= new Date()) throw new AppError(400, "Reset token is invalid or expired", "INVALID_RESET_TOKEN"); const passwordHash = await hashPassword(password); await prisma.$transaction([prisma.user.update({ where: { id: token.userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }), prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }), prisma.refreshSession.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } })]); }
