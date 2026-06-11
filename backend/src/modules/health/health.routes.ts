import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      return reply.status(503).send({
        status: "degraded",
        service: "dear-body-backend",
        reason: "database_offline",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    }
    return {
      status: "ok",
      service: "dear-body-backend",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  });
}
