import { FastifyInstance } from "fastify";
import {
  applyStockIssueAdjustments,
  completePacking,
  completePicking,
  flagWarehouseException,
  generatePackingSlip,
  getWarehouseDashboardSummary,
  getWarehouseOrderDetail,
  listWarehouseOrders,
  markAwaitingCollection,
  markCollected,
  recalculateCollectionDate,
  startPacking,
  startPicking,
  updatePickItem,
} from "./fulfillment.service.js";
import {
  getPudoPickupSchedule,
  upsertPudoPickupSchedule,
  getWarehouseCustomerSchedule,
  upsertWarehouseCustomerSchedule,
} from "./collection-schedule.service.js";

export async function fulfillmentRoutes(app: FastifyInstance) {
  // ── Collection Schedule (settings:write / warehouse:write) ─────────────────

  // ── Warehouse Customer Collection Schedule ─────────────────────────────────

  app.get(
    "/admin/fulfillment/collection-schedule",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:read")] },
    async (_request, reply) => {
      return reply.send({ data: await getWarehouseCustomerSchedule() });
    },
  );

  app.put(
    "/admin/fulfillment/collection-schedule",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      return reply.send({ data: await upsertWarehouseCustomerSchedule(request.body) });
    },
  );

  // ── PUDO Pickup Schedule ───────────────────────────────────────────────────

  app.get(
    "/admin/fulfillment/pudo-pickup-schedule",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:read")] },
    async (_request, reply) => {
      return reply.send({ data: await getPudoPickupSchedule() });
    },
  );

  app.put(
    "/admin/fulfillment/pudo-pickup-schedule",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      return reply.send({ data: await upsertPudoPickupSchedule(request.body) });
    },
  );

  // ── Warehouse Dashboard ────────────────────────────────────────────────────

  app.get(
    "/admin/warehouse/summary",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:read")] },
    async (_request, reply) => {
      return reply.send({ data: await getWarehouseDashboardSummary() });
    },
  );

  app.get(
    "/admin/warehouse/orders",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:read")] },
    async (request, reply) => {
      return reply.send({ data: await listWarehouseOrders(request.query) });
    },
  );

  app.get(
    "/admin/warehouse/orders/:orderId",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:read")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await getWarehouseOrderDetail(orderId) });
    },
  );

  // ── Pick workflow ──────────────────────────────────────────────────────────

  app.post(
    "/admin/warehouse/orders/:orderId/start-picking",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await startPicking(orderId, request.user.sub) });
    },
  );

  app.patch(
    "/admin/warehouse/orders/:orderId/pick-items/:pickTaskItemId",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId, pickTaskItemId } = request.params as { orderId: string; pickTaskItemId: string };
      return reply.send({ data: await updatePickItem(orderId, pickTaskItemId, request.body, request.user.sub) });
    },
  );

  app.post(
    "/admin/warehouse/orders/:orderId/complete-picking",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await completePicking(orderId, request.body, request.user.sub) });
    },
  );

  // ── Pack workflow ──────────────────────────────────────────────────────────

  app.post(
    "/admin/warehouse/orders/:orderId/start-packing",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await startPacking(orderId, request.user.sub) });
    },
  );

  app.post(
    "/admin/warehouse/orders/:orderId/complete-packing",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await completePacking(orderId, request.body, request.user.sub) });
    },
  );

  app.post(
    "/admin/warehouse/orders/:orderId/awaiting-collection",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await markAwaitingCollection(orderId, request.user.sub) });
    },
  );

  app.post(
    "/admin/warehouse/orders/:orderId/mark-collected",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      await markCollected(orderId, request.user.sub);
      return reply.send({ data: { success: true } });
    },
  );

  // ── Exception handling ─────────────────────────────────────────────────────

  app.post(
    "/admin/warehouse/orders/:orderId/exception",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const { notes = "" } = (request.body ?? {}) as { notes?: string };
      return reply.send({ data: await flagWarehouseException(orderId, request.user.sub, notes) });
    },
  );

  // ── Stock adjustments ──────────────────────────────────────────────────────

  app.post(
    "/admin/warehouse/orders/:orderId/apply-stock-adjustments",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      await applyStockIssueAdjustments(orderId, request.user.sub);
      return reply.send({ data: { success: true } });
    },
  );

  // ── Collection date ────────────────────────────────────────────────────────

  app.post(
    "/admin/warehouse/orders/:orderId/recalculate-collection",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:write")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      return reply.send({ data: await recalculateCollectionDate(orderId, request.user.sub) });
    },
  );

  // ── Packing slip ───────────────────────────────────────────────────────────

  app.get(
    "/admin/warehouse/orders/:orderId/packing-slip",
    { preHandler: [app.verifyAdmin, app.requirePermission("warehouse:read")] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const html = await generatePackingSlip(orderId);
      return reply.header("Content-Type", "text/html").send(html);
    },
  );
}
