import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  addCartItem,
  addOrderNote,
  applyCoupon,
  cancelOrder,
  checkoutCart,
  createCart,
  createRefund,
  deleteAllOrdersAndRestoreStock,
  getCart,
  getCustomerOrder,
  getOrder,
  getStoreOrderById,
  listStoreShippingMethods,
  listStoreShippingMethodsForDestination,
  quoteCart,
  listCustomerOrders,
  listOrders,
  removeCartItem,
  resolveStorefrontItems,
  updateCartItem,
  updateFulfillmentStatus,
  updateOrderStatus,
  updatePaymentStatus,
} from "./orders.service.js";
import { initiateOrderPayment, verifyOrderPayment } from "../payments/payments.service.js";

export async function ordersRoutes(app: FastifyInstance) {
  const withOrderId = (url: string | undefined, orderId: string) => {
    if (!url) return undefined;
    const parsed = new URL(url);
    if (!parsed.searchParams.has("orderId")) {
      parsed.searchParams.set("orderId", orderId);
    }
    return parsed.toString();
  };

  app.post("/store/cart", async (request, reply) => reply.status(201).send({ data: await createCart(request.body) }));
  app.get("/store/shipping-methods", async (request, reply) => {
    const query = request.query as { country?: string; state?: string };
    console.info("[shipping] store methods request", { country: query.country ?? null, state: query.state ?? null });
    if (query.country || query.state) {
      const methods = await listStoreShippingMethodsForDestination(query.country, query.state);
      console.info("[shipping] store methods response", { count: methods.length, filtered: true });
      return reply.send({ data: methods });
    }
    const methods = await listStoreShippingMethods();
    console.info("[shipping] store methods response", { count: methods.length, filtered: false });
    return reply.send({ data: methods });
  });
  app.post("/store/cart/quote", async (request, reply) => reply.send({ data: await quoteCart(request.body) }));
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
  app.post("/store/checkout/:cartId", { preHandler: [app.optionalCustomer] }, async (request, reply) => {
    const checkoutRouteStartedAt = Date.now();
    const { cartId } = request.params as { cartId: string };
    const customerId: string | null = (request as any).customer?.id ?? null;

    if (!customerId) {
      const checkoutSetting = await prisma.setting.findUnique({ where: { scope_key: { scope: "checkout", key: "rules" } } });
      const guestEnabled = ((checkoutSetting?.value ?? {}) as Record<string, unknown>).guestCheckoutEnabled !== false;
      if (!guestEnabled) {
        return reply.status(401).send({ error: { message: "Guest checkout is disabled. Please sign in to continue.", code: "GUEST_CHECKOUT_DISABLED" } });
      }
    }

    console.info("[checkout-timing] payment-init route entered", { cartId, requestId: request.id });
    const order = await checkoutCart(cartId, request.body, customerId);
    console.info("[checkout-timing] order creation/update complete", {
      cartId,
      orderId: order?.id,
      elapsedMs: Date.now() - checkoutRouteStartedAt,
    });
    const body = (request.body ?? {}) as { payment?: { gateway?: "stitch" | "payfast"; returnUrl?: string; cancelUrl?: string; referenceId?: string } };

    if (body.payment) {
      const payment = await initiateOrderPayment(order!.id, {
        gateway: body.payment.gateway,
        returnUrl: withOrderId(body.payment.returnUrl, order.id),
        cancelUrl: withOrderId(body.payment.cancelUrl, order.id),
      });
      console.info("[checkout-timing] response returned to frontend", {
        cartId,
        orderId: order.id,
        paymentProvider: payment.provider,
        elapsedMs: Date.now() - checkoutRouteStartedAt,
      });

      return reply.status(201).send({ data: { order, payment } });
    }

    console.info("[checkout-timing] response returned to frontend", {
      cartId,
      orderId: order?.id,
      paymentProvider: "none",
      elapsedMs: Date.now() - checkoutRouteStartedAt,
    });

    return reply.status(201).send({ data: { order } });
  });
  app.post("/store/checkout/resolve-items", async (request, reply) => reply.send({ data: await resolveStorefrontItems(request.body) }));

  // Public lightweight status check — orderId is a CUID (not guessable), used for guest payment return
  app.get("/store/orders/:orderId/payment-status", async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await getStoreOrderById(orderId);
    return reply.send({ data: { id: order.id, orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, status: order.status } });
  });

  app.get("/store/orders/:orderId", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await getStoreOrderById(orderId);
    if (order.customerId !== request.customer.id) return reply.status(404).send({ error: { message: "Order not found" } });
    return reply.send({ data: order });
  });
  app.post("/store/orders/:orderId/payments/initiate", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    await getCustomerOrder(request.customer.id, orderId);
    return reply.send({ data: await initiateOrderPayment(orderId, request.body) });
  });
  app.post("/store/orders/:orderId/payments/verify", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    await getCustomerOrder(request.customer.id, orderId);
    return reply.send({ data: await verifyOrderPayment(orderId, request.body) });
  });
  app.get("/store/account/orders", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    return reply.send({ data: await listCustomerOrders(request.customer.id) });
  });
  app.get("/store/account/orders/:orderId", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    return reply.send({ data: await getCustomerOrder(request.customer.id, orderId) });
  });

  app.get("/admin/orders", { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] }, async (request, reply) => {
    return reply.send({ data: await listOrders(request.query) });
  });
  app.delete("/admin/orders", { preHandler: [app.verifyAdmin, app.requirePermission("orders:delete-all")] }, async (request, reply) => {
    return reply.send({ data: await deleteAllOrdersAndRestoreStock(request.body, request.user.sub) });
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
