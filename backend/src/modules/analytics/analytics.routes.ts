import { FastifyInstance } from "fastify";
import {
  getLiveVisitors,
  getLocationBreakdown,
  getSiteOverview,
  getTopPages,
  getViewsByDay,
  trackPageLeave,
  trackPageView,
} from "./analytics.service.js";

export async function analyticsRoutes(app: FastifyInstance) {
  app.post("/track/pageview", async (request, reply) => {
    const ip = (request.headers["x-forwarded-for"] as string) ?? request.ip ?? "";
    await trackPageView(request.body, ip);
    return reply.status(204).send();
  });

  app.post("/track/pageleave", async (request, reply) => {
    await trackPageLeave(request.body);
    return reply.status(204).send();
  });

  app.get("/admin/reports/site/live", { preHandler: [app.verifyAdmin, app.requirePermission("dashboard:read")] }, async (_request, reply) => {
    return reply.send({ data: await getLiveVisitors() });
  });

  app.get("/admin/reports/site/overview", { preHandler: [app.verifyAdmin, app.requirePermission("dashboard:read")] }, async (request, reply) => {
    return reply.send({ data: await getSiteOverview(request.query) });
  });

  app.get("/admin/reports/site/top-pages", { preHandler: [app.verifyAdmin, app.requirePermission("dashboard:read")] }, async (request, reply) => {
    return reply.send({ data: await getTopPages(request.query) });
  });

  app.get("/admin/reports/site/locations", { preHandler: [app.verifyAdmin, app.requirePermission("dashboard:read")] }, async (request, reply) => {
    return reply.send({ data: await getLocationBreakdown(request.query) });
  });

  app.get("/admin/reports/site/views-by-day", { preHandler: [app.verifyAdmin, app.requirePermission("dashboard:read")] }, async (request, reply) => {
    return reply.send({ data: await getViewsByDay(request.query) });
  });
}
