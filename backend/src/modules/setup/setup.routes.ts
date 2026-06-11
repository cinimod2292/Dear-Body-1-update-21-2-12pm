import { timingSafeEqual } from "node:crypto";
import { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { runInitialSetup, SetupExecutionError } from "./setup.service.js";

// TEMPORARY ROUTE: Remove this entire file + app registration after first production setup.
const SETUP_ROUTE_PATH = "/internal/setup/initialize";
const SETUP_TOKEN_HEADER = "x-setup-token";

let setupCompleted = false;

function safeTokenEqual(provided: string, expected: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function setupRoutes(app: FastifyInstance) {
  app.post(SETUP_ROUTE_PATH, { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!env.SETUP_TOKEN) {
      return reply.status(503).send({
        success: false,
        error: "SETUP_TOKEN is not configured. Setup route is disabled.",
      });
    }

    const rawToken = request.headers[SETUP_TOKEN_HEADER];
    const providedToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!providedToken || !safeTokenEqual(providedToken, env.SETUP_TOKEN)) {
      request.log.warn({ ip: request.ip }, "Setup token validation failed");
      return reply.status(401).send({
        success: false,
        error: "Invalid setup token",
      });
    }

    if (setupCompleted) {
      return reply.status(409).send({
        success: false,
        error: "Setup has already been completed in this runtime",
      });
    }

    try {
      const result = await runInitialSetup();
      setupCompleted = true;

      return reply.send({
        success: true,
        message: "Database setup and initial admin seed completed",
        data: result,
      });
    } catch (error) {
      const stepDetails = error instanceof SetupExecutionError ? error.steps : undefined;

      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Unknown setup failure",
        details: stepDetails,
      });
    }
  });
}
