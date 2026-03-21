import { FastifyInstance } from "fastify";
import {
  addCartItem,
  addOrderNote,
  applyCoupon,
  cancelOrder,
  checkoutCart,
  createCart,
  createRefund,
  getCart,
  getOrder,
  listOrders,
  removeCartItem,
  updateCartItem,
  updateFulfillmentStatus,
  updateOrderStatus,
  updatePaymentStatus,
} from "./orders.service.js";

export async function ordersRoutes(app: FastifyInstance) {
  app.post("/store/cart", async (request, reply) => reply.status(201).send({ data: await createCart(request.body) }));
  app.get("/store/cart/:cartId", async (request, reply) => {
    const { cartId } = request.params as { cartId: string };
    return reply.send({ data: await getCart(cartId) });
  });
  app.post("/store/cart/:cartId/items", async (request, reply) => {
    const { cartId } = request.params as { cartId: string };
    return reply.send({ data: await addCartItem(cartId, request.body) });
  });
  app.patch("/store/cart/:cartId/items/:itemId", async (request, reply) => {
    const { cartId, itemId } = request.params as { cartId: string; itemId: string };
    return reply.send({ data: await updateCartItem(cartId, itemId, request.body) });
  });
  app.delete("/store/cart/:cartId/items/:itemId", async (request, reply) => {
    const { cartId, itemId } = request.params as { cartId: string; itemId: string };
    return reply.send({ data: await removeCartItem(cartId, itemId) });
  });
  app.post("/store/cart/:cartId/coupon", async (request, reply) => {
    const { cartId } = request.params as { cartId: string };
    return reply.send({ data: await applyCoupon(cartId, request.body) });
  });
  app.post("/store/checkout/:cartId", async (request, reply) => {
    const { cartId } = request.params as { cartId: string };
    return reply.status(201).send({ data: await checkoutCart(cartId, request.body) });
  });

  app.get("/admin/orders", { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] }, async (request, reply) => {
    return reply.send({ data: await listOrders(request.query) });
  });
  app.get("/admin/orders/:orderId", { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.send({ data: await getOrder(orderId) });
  });
  app.post("/admin/orders/:orderId/status", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.send({ data: await updateOrderStatus(orderId, request.body, request.user.sub) });
  });
  app.post("/admin/orders/:orderId/payment-status", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.send({ data: await updatePaymentStatus(orderId, request.body, request.user.sub) });
  });
  app.post("/admin/orders/:orderId/fulfillment-status", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.send({ data: await updateFulfillmentStatus(orderId, request.body, request.user.sub) });
  });
  app.post("/admin/orders/:orderId/notes", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.status(201).send({ data: await addOrderNote(orderId, request.body, request.user.sub) });
  });
  app.post("/admin/orders/:orderId/cancel", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.send({ data: await cancelOrder(orderId, request.body, request.user.sub) });
  });
  app.post("/admin/orders/:orderId/refunds", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.status(201).send({ data: await createRefund(orderId, request.body, request.user.sub) });
  });
}
