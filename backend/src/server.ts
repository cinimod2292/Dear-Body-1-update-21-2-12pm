import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { runManualMigrations } from "./lib/migrate.js";
import { initEmailTemplates } from "./modules/email-templates/email-template.service.js";

process.on("unhandledRejection", (reason) => {
  console.error("[startup] Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[startup] Uncaught exception", error);
  process.exit(1);
});

async function gracefulShutdown(signal: string) {
  if (app) {
    app.log.info(`[shutdown] ${signal} received — closing server`);
    try {
      await app.close();
    } catch (err) {
      app.log.error({ err }, "[shutdown] Error closing server");
    }
  }
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

let app: Awaited<ReturnType<typeof buildApp>> | null = null;

try {
  console.info("[startup] Building Fastify app");
  app = await buildApp();

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  app.log.info("[startup] Checking database connectivity");
  await prisma.$connect();
  app.log.info("[startup] Database connectivity OK");

  app.log.info("[startup] Running pending manual migrations");
  await runManualMigrations();
  app.log.info("[startup] Migrations complete");

  app.log.info("[startup] Syncing email templates");
  await initEmailTemplates();
  app.log.info("[startup] Email templates synced");

  const address = await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const adminLoginPath = `${env.API_PREFIX}/auth/admin/login`;
  const routes = app.printRoutes();
  app.log.info(`[startup] Listening at ${address}`);
  app.log.info(`[startup] API prefix: ${env.API_PREFIX}`);
  app.log.info(`[startup] Expected admin login route: POST ${adminLoginPath}`);
  app.log.info(`[startup] Registered routes:
${routes}`);
} catch (error) {
  if (app) {
    app.log.error({ err: error }, "[startup] Fatal startup error");
  } else {
    console.error("[startup] Fatal startup error before logger init", error);
  }

  try {
    await prisma.$disconnect();
  } catch (disconnectError) {
    console.error("[startup] Failed to disconnect Prisma after startup error", disconnectError);
  }

  process.exit(1);
}
