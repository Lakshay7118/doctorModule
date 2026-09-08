import type { ErrorRequestHandler, RequestHandler } from "express";
import { randomUUID } from "crypto";
import { Prisma } from "../generated/prisma";
import { AppError } from "../utils/errors";
import { logger } from "../config/logger";

export const requestId: RequestHandler = (req, res, next) => { req.requestId = req.get("x-request-id") ?? randomUUID(); res.setHeader("x-request-id", req.requestId); next(); };
export const notFoundHandler: RequestHandler = (_req, res) => { res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }); };
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.status === 400 && error.details ? { details: "Request validation failed" } : {}) }, requestId: req.requestId });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: { code: "CONFLICT", message: "Resource already exists" }, requestId: req.requestId });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return res.status(409).json({ error: { code: "CONCURRENT_UPDATE", message: "A concurrent update prevented this operation; retry using the same idempotency key" }, requestId: req.requestId });
  logger.error({ err: error, requestId: req.requestId }, "Unhandled request error");
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" }, requestId: req.requestId });
};
