import { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "dear-body-backend",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }));
}
