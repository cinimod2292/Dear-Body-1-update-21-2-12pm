import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { webhookParamsSchema } from "./webhook.schemas.js";

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/:source", async (request, reply) => {
    const params = webhookParamsSchema.parse(request.params);
    const signature = request.headers["x-signature"]?.toString();

    if (!signature || signature !== env.WEBHOOK_SIGNING_SECRET) {
      throw new AppError(401, "Invalid webhook signature", "INVALID_WEBHOOK_SIGNATURE");
    }

    const payload = request.body ?? {};
    const eventType = request.headers["x-event-type"]?.toString() ?? "unknown";

    const event = await prisma.webhookEvent.create({
      data: {
        source: params.source,
        eventType,
        signature,
        payload: payload as object,
        status: "RECEIVED",
      },
    });

    return reply.status(202).send({ data: { id: event.id, status: event.status } });
  });
}
