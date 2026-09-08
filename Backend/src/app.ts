import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { getEnv } from "./config/env";
import { logger } from "./config/logger";
import { generalRateLimit, authRateLimit } from "./middleware/rate-limit";
import { errorHandler, notFoundHandler, requestId } from "./middleware/error-handler";
import { authRoutes } from "./modules/auth/routes";
import { adminRoutes } from "./modules/admin/routes";
import { userRoutes } from "./modules/users/routes";
import { encounterRoutes, patientRoutes } from "./modules/patients/routes";
import { clientRoutes, practitionerRoutes } from "./modules/clients/routes";
import { catalogRoutes } from "./modules/catalog/routes";
import { orderRoutes } from "./modules/orders/routes";
import { collectionRoutes, accessioningRoutes, specimenRoutes } from "./modules/specimens/routes";
import { logisticsRoutes } from "./modules/logistics/routes";
import { workbenchRoutes } from "./modules/workbench/routes";
import { resultRoutes, reportRoutes } from "./modules/results/routes";
import { qualityRoutes } from "./modules/quality/routes";
import { inventoryRoutes } from "./modules/inventory/routes";
import { billingRoutes } from "./modules/billing/routes";
import { communicationRoutes } from "./modules/communications/routes";
import { integrationRoutes } from "./modules/integrations/routes";
import { dashboardRoutes, analyticsRoutes } from "./modules/dashboard/routes";
import { queueRoutes, schedulingRoutes } from "./modules/operations/routes";
import { supportRoutes } from "./modules/support/routes";
import { settingsRoutes } from "./modules/settings/routes";
import { openApiDocument } from "./docs/openapi";
import { protectedRouter } from "./middleware/protected";
import { hospitalRoutes } from "./modules/hospital/routes";

export function createApp() {
  const env = getEnv(); const app = express(); const origins = new Set(env.CORS_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean));
  app.disable("x-powered-by"); app.set("trust proxy", 1);
  app.use(requestId, pinoHttp({ logger, customProps: (req) => ({ requestId: req.id }) }));
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:"], objectSrc: ["'none'"] } } }));
  app.use(cors({ credentials: true, origin: (origin, callback) => { if (!origin || origins.has(origin)) callback(null, true); else callback(null, false); } }));
  app.use(hpp(), express.json({ limit: "256kb" }), express.urlencoded({ extended: false, limit: "64kb" }), cookieParser(), generalRateLimit);
  app.get(["/health", "/api/health"], (_req, res) => { res.json({ status: "ok" }); });
  if (env.NODE_ENV !== "production") {
    const docs = protectedRouter();
    docs.use(swaggerUi.serve, swaggerUi.setup(openApiDocument));
    app.use("/api/docs", docs);
    const spec = protectedRouter();
    spec.get("/", (_req, res) => res.json(openApiDocument));
    app.use("/api/openapi.json", spec);
  }
  app.use("/api/auth", authRateLimit, authRoutes); app.use("/api/users", userRoutes); app.use("/api/admin", adminRoutes); app.use("/api/patients", patientRoutes); app.use("/api/encounters", encounterRoutes); app.use("/api/clients", clientRoutes); app.use("/api/practitioners", practitionerRoutes); app.use("/api/catalog", catalogRoutes); app.use("/api/orders", orderRoutes); app.use("/api/collection", collectionRoutes); app.use("/api/accessioning", accessioningRoutes); app.use("/api/specimens", specimenRoutes); app.use("/api/logistics", logisticsRoutes); app.use("/api/workbench", workbenchRoutes); app.use("/api/results", resultRoutes); app.use("/api/reports", reportRoutes); app.use("/api/quality", qualityRoutes); app.use("/api/inventory", inventoryRoutes); app.use("/api/billing", billingRoutes); app.use("/api/communications", communicationRoutes); app.use("/api/integrations", integrationRoutes); app.use("/api/dashboard", dashboardRoutes); app.use("/api/analytics", analyticsRoutes); app.use("/api/queues", queueRoutes); app.use("/api/scheduling", schedulingRoutes); app.use("/api/support", supportRoutes); app.use("/api/settings", settingsRoutes);
  app.use("/api/hms", hospitalRoutes);
  app.use(notFoundHandler, errorHandler); return app;
}
