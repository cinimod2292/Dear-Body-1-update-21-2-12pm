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

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  app.register(cors, {
    origin: env.CORS_ORIGIN,
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
    await api.register(auditRoutes);
    await api.register(webhookRoutes);
  }, { prefix: env.API_PREFIX });

  registerErrorHandler(app);

  return app;
}
