import { FastifyInstance } from "fastify";
import {
  createPudoShipment,
  diagnosePudoApi,
  downloadPudoWaybill,
  getPudoLockers,
  getPudoRates,
  getPudoSettings,
  listPudoShipments,
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
      },
    });
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

  app.get(
    "/admin/pudo/shipments",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (_request, reply) => reply.send({ data: await listPudoShipments() }),
  );

  app.get(
    "/admin/pudo/diagnose",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await diagnosePudoApi() }),
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
