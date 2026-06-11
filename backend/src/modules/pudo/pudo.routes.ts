import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  autoCreatePudoShipment,
  createPudoShipment,
  deleteAllShipments,
  diagnosePudoApi,
  downloadPudoWaybill,
  getPudoDoorRates,
  getPudoLockers,
  getPudoRates,
  getPudoSettings,
  getPudoShippingOption,
  getOrderPudoTracking,
  listLocalPudoOrders,
  listPudoShipments,
  processPudoTrackingWebhook,
  syncPudoRates,
  syncPudoTrackingStatuses,
  trackPudoShipment,
  upsertPudoSettings,
} from "./pudo.service.js";

export async function pudoRoutes(app: FastifyInstance) {
  // Public store endpoints — no auth required
  app.get("/store/pudo/config", async (_request, reply) => {
    const settings = await getPudoSettings();
    return reply.send({
      data: {
        enabled: settings.enabled,
        allowCustomerLockerSelection: settings.allowCustomerLockerSelection,
        doorDeliveryEnabled: settings.doorDeliveryEnabled,
      },
    });
  });

  app.get("/store/pudo/shipping-options", async (request, reply) => {
    const { itemCount } = request.query as { itemCount?: string };
    const count = Math.max(1, parseInt(itemCount ?? "1", 10) || 1);
    return reply.send({ data: await getPudoShippingOption(count) });
  });

  app.get("/store/pudo/lockers", async (request, reply) => {
    const settings = await getPudoSettings();
    if (!settings.enabled || !settings.allowCustomerLockerSelection) {
      return reply.status(403).send({ error: { message: "PUDO locker selection is not enabled" } });
    }
    const { search } = request.query as { search?: string };
    return reply.send({ data: await getPudoLockers(search) });
  });

  app.get(
    "/admin/integrations/pudo/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await getPudoSettings() }),
  );

  app.put(
    "/admin/integrations/pudo/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => reply.send({ data: await upsertPudoSettings(request.body) }),
  );

  app.get(
    "/admin/pudo/lockers",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => {
      const { search } = request.query as { search?: string };
      return reply.send({ data: await getPudoLockers(search) });
    },
  );

  app.post(
    "/admin/pudo/shipment",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => reply.send({ data: await createPudoShipment(request.body as Parameters<typeof createPudoShipment>[0]) }),
  );

  app.get(
    "/admin/pudo/track/:waybill",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => {
      const { waybill } = request.params as { waybill: string };
      return reply.send({ data: await trackPudoShipment(waybill) });
    },
  );

  app.post(
    "/admin/pudo/rates",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => {
      const { lockerCode } = request.body as { lockerCode: string };
      return reply.send({ data: await getPudoRates(lockerCode) });
    },
  );

  app.post(
    "/admin/pudo/rates/door",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => {
      const body = request.body as { streetAddress: string; localArea?: string; city: string; postalCode?: string; province?: string };
      return reply.send({ data: await getPudoDoorRates(body) });
    },
  );

  app.get(
    "/admin/pudo/shipments",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (_request, reply) => reply.send({ data: await listPudoShipments() }),
  );

  app.delete(
    "/admin/pudo/shipments",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:delete-all")] },
    async (request, reply) => reply.send({ data: await deleteAllShipments(request.body) }),
  );

  app.get(
    "/admin/pudo/orders",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => {
      const { page, perPage } = request.query as { page?: string; perPage?: string };
      return reply.send({ data: await listLocalPudoOrders(Number(page ?? 1), Number(perPage ?? 50)) });
    },
  );

  app.post(
    "/admin/orders/:orderId/pudo-shipment",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const { suburb } = (request.body as { suburb?: string } | null) ?? {};
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, pudoDeliveryType: true, trackingNumber: true, pudoLockerCode: true, shippingAddressId: true },
      });
      if (!order) {
        return reply.status(404).send({ error: { message: "Order not found" } });
      }
      if (order.trackingNumber) {
        return reply.send({ data: { waybillNumber: order.trackingNumber, alreadyExists: true } });
      }
      if (!order.pudoDeliveryType) {
        return reply.status(400).send({ error: { message: "Order does not have a PUDO delivery type — cannot create shipment" } });
      }
      // Save suburb to the address record so autoCreatePudoShipment picks it up
      if (suburb?.trim() && order.shippingAddressId) {
        await prisma.address.update({
          where: { id: order.shippingAddressId },
          data: { suburb: suburb.trim() },
        });
      }
      await autoCreatePudoShipment(orderId);
      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        select: { trackingNumber: true },
      });
      if (!updated?.trackingNumber) {
        return reply.status(502).send({ error: { message: "PUDO shipment creation failed — check server logs for details" } });
      }
      return reply.send({ data: { waybillNumber: updated.trackingNumber } });
    },
  );



  app.post(
    "/admin/pudo/sync-tracking",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (_request, reply) => reply.send({ data: await syncPudoTrackingStatuses() }),
  );

  app.post(
    "/admin/pudo/sync-rates",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (_request, reply) => reply.send({ data: await syncPudoRates() }),
  );

  app.get(
    "/admin/pudo/diagnose",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await diagnosePudoApi() }),
  );

  // Customer-facing: live PUDO tracking for their own order
  app.get(
    "/store/orders/:orderId/pudo-tracking",
    { preHandler: [app.verifyCustomer] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const customerId = (request as any).customer.id as string;
      const result = await getOrderPudoTracking(orderId, customerId);
      return reply.send({ data: result });
    },
  );

  // PUDO tracking webhook — public, no auth (PUDO posts here when shipment status changes)
  app.post(
    "/webhooks/pudo-tracking",
    async (request, reply) => {
      void processPudoTrackingWebhook(request.body).catch((err) => {
        console.error("[PUDO webhook] processing error:", err);
      });
      return reply.status(200).send({ received: true });
    },
  );

  // Proxies the PUDO waybill PDF through our backend (PUDO requires Bearer auth, browsers can't send that directly)
  app.get(
    "/admin/pudo/waybill/:shipmentId",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => {
      const { shipmentId } = request.params as { shipmentId: string };
      const { body, contentType } = await downloadPudoWaybill(Number(shipmentId));
      return reply
        .header("Content-Type", contentType)
        .header("Content-Disposition", `attachment; filename="waybill-${shipmentId}.pdf"`)
        .send(body);
    },
  );
}
