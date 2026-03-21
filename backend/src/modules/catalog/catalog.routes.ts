import { FastifyInstance } from "fastify";
import { bulkProductAction, createProduct, createVariant, listProducts, updateProduct, updateVariant } from "./catalog.service.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/admin/products", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (request, reply) => {
    const result = await listProducts(request.query);
    return reply.send({ data: result });
  });

  app.post("/admin/products", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const product = await createProduct(request.body);
    return reply.status(201).send({ data: product });
  });

  app.patch("/admin/products/:productId", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const params = request.params as { productId: string };
    const product = await updateProduct(params.productId, request.body);
    return reply.send({ data: product });
  });

  app.post("/admin/products/bulk", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const result = await bulkProductAction(request.body);
    return reply.send({ data: result });
  });

  app.post("/admin/products/:productId/variants", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const params = request.params as { productId: string };
    const variant = await createVariant(params.productId, request.body);
    return reply.status(201).send({ data: variant });
  });

  app.patch("/admin/variants/:variantId", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const params = request.params as { variantId: string };
    const variant = await updateVariant(params.variantId, request.body);
    return reply.send({ data: variant });
  });
}
