import { FastifyInstance } from "fastify";
import { PassThrough } from "node:stream";
import {
  getPayfastSettings,
  getPaymentGatewayOptions,
  getStitchSettings,
  handlePayfastWebhook,
  handleStitchWebhook,
  initiateOrderPayment,
  listPaymentEvents,
  upsertPayfastSettings,
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
    "/admin/payments/settings/payfast",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await getPayfastSettings() }),
  );

  app.put(
    "/admin/payments/settings/payfast",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => reply.send({ data: await upsertPayfastSettings(request.body) }),
  );

  app.get("/store/payments/gateways", async (_request, reply) => reply.send({ data: await getPaymentGatewayOptions() }));

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

  app.post("/payments/stitch/webhook", {
    preParsing: (request, _reply, payload, done) => {
      const chunks: Buffer[] = [];
      payload.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      payload.on("end", () => {
        (request as any).rawBody = Buffer.concat(chunks).toString("utf8");
      });

      const tee = new PassThrough();
      payload.pipe(tee);
      done(null, tee);
    },
  }, async (request, reply) => {
    request.log.info({ route: "/payments/stitch/webhook" }, "Stitch webhook received");
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value?.toString()]),
    );
    headers[":method"] = request.method;
    headers[":path"] = request.url;

    const payload = (request.body ?? {}) as Record<string, unknown>;
    const rawBody = typeof (request as any).rawBody === "string"
      ? (request as any).rawBody
      : "";

    try {
      const result = await handleStitchWebhook(headers, payload, rawBody);
      if ((result as any).duplicate) {
        request.log.info({ result }, "Stitch webhook duplicate delivery ignored");
      } else if ((result as any).ignored) {
        request.log.info({ result }, "Stitch webhook ignored");
      } else if ((result as any).noOp) {
        request.log.info({ result }, "Stitch webhook no-op");
      } else {
        request.log.info({ result }, "Stitch webhook processed successfully");
      }
      return reply.send({ data: result });
    } catch (error) {
      request.log.warn({ err: error }, "Stitch webhook rejected");
      throw error;
    }
  });

  app.post("/payments/payfast/webhook", {
    preParsing: (request, _reply, payload, done) => {
      const chunks: Buffer[] = [];
      payload.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      payload.on("end", () => {
        (request as any).rawBody = Buffer.concat(chunks).toString("utf8");
      });

      const tee = new PassThrough();
      payload.pipe(tee);
      done(null, tee);
    },
  }, async (request, reply) => {
    request.log.info({
      route: "/payments/payfast/webhook",
      method: request.method,
      path: request.url,
      contentType: request.headers["content-type"],
    }, "PayFast webhook received");
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value?.toString()]),
    );
    headers[":method"] = request.method;
    headers[":path"] = request.url;
    const payload = (request.body ?? {}) as Record<string, unknown>;
    const rawBody = typeof (request as any).rawBody === "string"
      ? (request as any).rawBody
      : "";
    request.log.info({
      rawBodyPreview: rawBody.length > 1000 ? `${rawBody.slice(0, 1000)}...[truncated]` : rawBody,
      rawBodyLength: rawBody.length,
    }, "PayFast webhook raw body captured");
    try {
      const result = await handlePayfastWebhook(headers, payload, rawBody);
      request.log.info({ result }, "PayFast webhook processed");
      return reply.send({ data: result });
    } catch (error) {
      request.log.warn({ err: error }, "PayFast webhook rejected");
      throw error;
    }
  });
}
