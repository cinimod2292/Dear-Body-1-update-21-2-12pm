import { FastifyInstance } from "fastify";
import {
  discoverXeroTenants,
  getXeroConnectUrl,
  getXeroSettings,
  handleXeroCallback,
  listXeroSyncRecords,
  recordPaymentInXero,
  retryXeroSync,
  syncCustomerToXero,
  syncOrderInvoiceToXero,
  syncRefundToXero,
  upsertXeroSettings,
} from "./xero.service.js";

export async function xeroRoutes(app: FastifyInstance) {
  app.get(
    "/admin/integrations/xero/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await getXeroSettings() }),
  );

  app.put(
    "/admin/integrations/xero/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => reply.send({ data: await upsertXeroSettings(request.body) }),
  );

  app.get(
    "/admin/integrations/xero/connect-url",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (_request, reply) => reply.send({ data: await getXeroConnectUrl() }),
  );

  app.get("/integrations/xero/callback", async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (!code || !state) {
      return reply.status(400).send({ error: { code: "XERO_CALLBACK_INVALID", message: "Missing code/state" } });
    }

    const data = await handleXeroCallback(code, state);
    return reply.send({ data });
  });

  app.get(
    "/admin/integrations/xero/tenants",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await discoverXeroTenants() }),
  );

  app.get(
    "/admin/integrations/xero/sync-records",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] },
    async (request, reply) => reply.send({ data: await listXeroSyncRecords(request.query) }),
  );

  app.post(
    "/admin/integrations/xero/sync/customer/:customerId",
    { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] },
    async (request, reply) => {
      const { customerId } = request.params as { customerId: string };
      return reply.send({ data: await syncCustomerToXero(customerId) });
    },
  );

  app.post(
    "/admin/integrations/xero/sync/order/:orderId",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await syncOrderInvoiceToXero(orderId) });
    },
  );

  app.post(
    "/admin/integrations/xero/sync/refund/:refundId",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => {
      const { refundId } = request.params as { refundId: string };
      return reply.send({ data: await syncRefundToXero(refundId) });
    },
  );

  app.post(
    "/admin/integrations/xero/sync/payment/:orderId",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const { xeroInvoiceId, amount, date, reference } = request.body as {
        xeroInvoiceId: string;
        amount: number;
        date: string;
        reference?: string;
      };
      return reply.send({ data: await recordPaymentInXero(orderId, xeroInvoiceId, { amount, date, reference }) });
    },
  );

  app.post(
    "/admin/integrations/xero/sync-records/:id/retry",
    { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ data: await retryXeroSync(id, request.body) });
    },
  );
}
