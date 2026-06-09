import Fastify from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { registerErrorHandler } from "./lib/errors.js";
import { prisma } from "./lib/prisma.js";
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
import { pudoRoutes } from "./modules/pudo/pudo.routes.js";
import { syncPudoRates } from "./modules/pudo/pudo.service.js";
import { setupRoutes } from "./modules/setup/setup.routes.js";
import { storeAccountRoutes } from "./modules/store-account/store-account.routes.js";
import { builderRoutes } from "./modules/builder/builder.routes.js";
import { processAbandonedCarts } from "./modules/ops/ops.service.js";

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === "production"
      ? { transport: { target: "pino-pretty" } }
      : true,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin)) return cb(null, true);
      if (/\.vercel\.app$/i.test(origin)) return cb(null, true);
      if (/\.onrender\.com$/i.test(origin)) return cb(null, true);
      const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
      if (allowed.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    preflight: true,
  });

  if (env.MAINTENANCE_MODE) {
    app.addHook("onRequest", async (request, reply) => {
      const { url } = request;
      // Allow health probes and the CMS bootstrap (so the frontend can read the maintenance flag)
      if (
        url === "/ping" ||
        url === `${env.API_PREFIX}/health` ||
        url.startsWith(`${env.API_PREFIX}/store/cms/bootstrap`)
      ) return;
      reply.status(503).send({
        error: {
          code: "MAINTENANCE",
          message: "The service is temporarily unavailable for maintenance. Please check back soon.",
        },
      });
    });
  }

  app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 5,
    },
  });

  app.register(authPlugin);

  app.addContentTypeParser(/^application\/octet-stream(?:\s*;.*)?$/i, { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });
  app.addContentTypeParser(/^image\/.*/i, { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });
  app.addContentTypeParser(/^application\/x-www-form-urlencoded(?:\s*;.*)?$/i, { parseAs: "string" }, (_request, body, done) => {
    const params = new URLSearchParams(typeof body === "string" ? body : body.toString("utf8"));
    const parsed: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      parsed[key] = value;
    }
    done(null, parsed);
  });

  const localUploadRoot = path.resolve(process.cwd(), ".local-uploads");
  const resolveLocalUploadPath = (storageKey: string) => {
    const sanitized = storageKey.replace(/^\/+/, "");
    const resolved = path.resolve(localUploadRoot, sanitized);
    if (!resolved.startsWith(localUploadRoot)) {
      throw new Error("Invalid storage key path");
    }
    return resolved;
  };

  app.put("/local-upload/*", async (request, reply) => {
    const storageKey = String((request.params as Record<string, string>)["*"] ?? "").trim();
    if (!storageKey) return reply.status(400).send({ error: { message: "Missing storage key" } });

    const filePath = resolveLocalUploadPath(storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const contentType = request.headers["content-type"] ?? null;
    const bodyBuffer = (() => {
      if (Buffer.isBuffer(request.body)) return request.body;
      if (typeof request.body === "string") return Buffer.from(request.body);
      return Buffer.alloc(0);
    })();
    const size = bodyBuffer.length;
    request.log.info({ storageKey, contentType, size }, "Writing local-upload file");

    await fs.writeFile(filePath, bodyBuffer);
    request.log.info({ storageKey, filePath, size }, "Local-upload file write success");

    return reply.status(200).send({ ok: true });
  });

  app.get("/local-upload/*", async (request, reply) => {
    const storageKey = String((request.params as Record<string, string>)["*"] ?? "").trim();
    if (!storageKey) return reply.status(400).send({ error: { message: "Missing storage key" } });

    const filePath = resolveLocalUploadPath(storageKey);
    let file: Buffer;
    try {
      file = await fs.readFile(filePath);
    } catch {
      return reply.status(404).send({ error: { message: "File not found" } });
    }

    const asset = await prisma.mediaAsset.findUnique({
      where: { storageKey },
      select: { mimeType: true },
    });
    reply.header("Content-Type", asset?.mimeType || "application/octet-stream");
    if (storageKey.startsWith("variants/")) {
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      reply.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    }
    return reply.send(file);
  });

  app.addHook("onResponse", async (request, reply) => {
    if (!request.url.startsWith(`${env.API_PREFIX}/admin`)) {
      return;
    }

    const actorEmail = request.user?.email;
    const actorUserId = request.user?.sub;

    try {
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
    } catch (error) {
      request.log.warn(
        { err: error, url: request.url, method: request.method },
        "Audit log write failed; request already completed",
      );
    }
  });

  app.get("/ping", async (_request, reply) => reply.status(200).send({ ok: true }));

  app.get("/__debug/routes", async () => {
    const expectedAdminLoginPath = `${env.API_PREFIX}/auth/admin/login`;

    return {
      apiPrefix: env.API_PREFIX,
      expectedAdminLoginPath,
      routes: app.printRoutes(),
    };
  });

  app.register(async (api) => {
    await api.register(setupRoutes);
    await api.register(healthRoutes);
    await api.register(authRoutes);
    await api.register(settingsRoutes);
    await api.register(mediaRoutes);
    await api.register(taxonomyRoutes);
    await api.register(catalogRoutes);
    await api.register(inventoryRoutes);
    await api.register(crmRoutes);
    await api.register(ordersRoutes);
    await api.register(storeAccountRoutes);
    await api.register(builderRoutes);
    await api.register(emailTemplateRoutes);
    await api.register(paymentsRoutes);
    await api.register(xeroRoutes);
    await api.register(cmsRoutes);
    await api.register(opsRoutes);
    await api.register(pudoRoutes);
    await api.register(auditRoutes);
    await api.register(webhookRoutes);
  }, { prefix: env.API_PREFIX });

  registerErrorHandler(app);

  const abandonedCartInterval = setInterval(() => {
    processAbandonedCarts().catch((error) => {
      app.log.warn({ err: error }, "Abandoned cart processor failed");
    });
  }, 60_000);
  abandonedCartInterval.unref();

  // Daily 4am UTC rate sync (= 6am SAST)
  function scheduleNextRateSync() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(4, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const delay = next.getTime() - now.getTime();
    const timer = setTimeout(() => {
      syncPudoRates().catch((err) => app.log.error({ err }, "PUDO rate sync failed"));
      scheduleNextRateSync();
    }, delay);
    timer.unref();
  }
  scheduleNextRateSync();

  return app;
}
