import type { RequestHandler } from "express";
import { prisma } from "../db/prisma";
import { forbidden, unauthorized } from "../utils/errors";
import { toAuthUser } from "../modules/auth/service";

export const requireActiveAccount: RequestHandler = async (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  try {
    const membership = await prisma.tenantMembership.findFirst({ where: { id: req.user.membershipId, tenantId: req.user.tenantId, userId: req.user.userId }, include: { user: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } }, siteScopes: true, departmentScopes: true } });
    if (!membership || membership.user.status !== "ACTIVE") return next(forbidden());
    // Access changes take effect immediately, including for unexpired access tokens.
    req.user = toAuthUser(membership);
    return next();
  } catch (error) { return next(error); }
};
