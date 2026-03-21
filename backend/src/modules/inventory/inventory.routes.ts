import { FastifyInstance } from "fastify";
import { adjustStock, listInventory, listStockMovements } from "./inventory.service.js";

export async function inventoryRoutes(app: FastifyInstance) {
  app.get("/admin/inventory", { preHandler: [app.verifyAdmin, app.requirePermission("inventory:read")] }, async (request, reply) => {
    const result = await listInventory(request.query);
    return reply.send({ data: result });
  });

  app.post("/admin/inventory/adjust", { preHandler: [app.verifyAdmin, app.requirePermission("inventory:write")] }, async (request, reply) => {
    const result = await adjustStock(request.body, request.user.sub);
    return reply.send({ data: result });
  });

  app.get("/admin/inventory/variants/:variantId/movements", { preHandler: [app.verifyAdmin, app.requirePermission("inventory:read")] }, async (request, reply) => {
    const params = request.params as { variantId: string };
    const movements = await listStockMovements(params.variantId);
    return reply.send({ data: movements });
  });
}
