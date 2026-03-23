import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { registerErrorHandler } from "./lib/errors.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { webhookRoutes } from "./modules/webhooks/webhook.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { writeAuditLog } from "./modules/audit/audit.service.js";
import { taxonomyRoutes } from "./modules/taxonomy/taxonomy.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { crmRoutes } from "./modules/crm/crm.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { emailTemplateRoutes } from "./modules/email-templates/email-template.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { xeroRoutes } from "./modules/accounting/xero.routes.js";
import { cmsRoutes } from "./modules/cms/cms.routes.js";
import { opsRoutes } from "./modules/ops/ops.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "production"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  const corsOrigin = process.env.CORS_ORIGIN ?? env.CORS_ORIGIN;

  if (env.NODE_ENV === "production" && corsOrigin === "*") {
    throw new Error("CORS_ORIGIN cannot be '*' in production");
  }

  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 5,
    },
  });

  app.register(authPlugin);

  app.addHook("onResponse", async (request, reply) => {
    if (!request.url.startsWith(`${env.API_PREFIX}/admin`)) {
      return;
    }

    const actorEmail = request.user?.email;
    const actorUserId = request.user?.sub;

    await writeAuditLog({
      actorUserId,
      actorEmail,
      action: `${request.method} ${request.url}`,
      resourceType: "api",
      details: {
        statusCode: reply.statusCode,
      },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
  });

  app.register(async (api) => {
    await api.register(healthRoutes);
    await api.register(authRoutes);
    await api.register(settingsRoutes);
    await api.register(mediaRoutes);
    await api.register(taxonomyRoutes);
    await api.register(catalogRoutes);
    await api.register(inventoryRoutes);
    await api.register(crmRoutes);
    await api.register(ordersRoutes);
    await api.register(emailTemplateRoutes);
    await api.register(paymentsRoutes);
    await api.register(xeroRoutes);
    await api.register(cmsRoutes);
    await api.register(opsRoutes);
    await api.register(auditRoutes);
    await api.register(webhookRoutes);
  }, { prefix: env.API_PREFIX });

  registerErrorHandler(app);

  return app;
}
