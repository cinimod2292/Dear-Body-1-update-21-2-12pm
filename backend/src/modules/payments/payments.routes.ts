import { FastifyInstance } from "fastify";
import {
  getStitchSettings,
  handleStitchWebhook,
  initiateOrderPayment,
  listPaymentEvents,
  upsertStitchSettings,
  verifyOrderPayment,
} from "./payments.service.js";

export async function paymentsRoutes(app: FastifyInstance) {
  app.get(
    "/admin/payments/settings/stitch",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await getStitchSettings() }),
  );

  app.put(
    "/admin/payments/settings/stitch",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => reply.send({ data: await upsertStitchSettings(request.body) }),
  );

  app.get(
    "/admin/payments/events",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => reply.send({ data: await listPaymentEvents(request.query) }),
  );

  app.post(
    "/admin/orders/:orderId/payments/initiate",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await initiateOrderPayment(orderId, request.body, request.user.sub) });
    },
  );

  app.post(
    "/admin/orders/:orderId/payments/verify",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await verifyOrderPayment(orderId, request.body) });
    },
  );

  app.post("/payments/stitch/webhook", async (request, reply) => {
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value?.toString()]),
    );

    const payload = (request.body ?? {}) as Record<string, unknown>;
    const rawBody = JSON.stringify(payload);
    const result = await handleStitchWebhook(headers, payload, rawBody);
    return reply.send({ data: result });
  });
}
