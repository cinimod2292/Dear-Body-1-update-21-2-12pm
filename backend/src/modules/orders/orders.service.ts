import { prisma } from "../../lib/prisma.js";
import {
  applyCouponSchema,
  cartCreateSchema,
  cartItemCreateSchema,
  cartItemUpdateSchema,
  checkoutSchema,
  orderCancelSchema,
  orderListQuerySchema,
  orderNoteSchema,
  orderStatusUpdateSchema,
  refundSchema,
} from "./orders.schemas.js";
import { AppError } from "../../lib/errors.js";
import { toPaginatedResponse } from "../../lib/pagination.js";
import { z } from "zod";

async function recalcCart(cartId: string) {
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true, coupon: true, shippingMethod: true, shippingAddress: true } });
  if (!cart) throw new AppError(404, "Cart not found", "CART_NOT_FOUND");

  const subtotal = cart.items.reduce((sum, item) => sum + Number(item.salePrice ?? item.unitPrice) * item.quantity, 0);
  let discount = 0;

  if (cart.coupon && cart.coupon.isActive) {
    const minAmt = Number(cart.coupon.minimumAmount ?? 0);
    if (subtotal >= minAmt) {
      if (cart.coupon.discountType === "PERCENT") {
        discount = subtotal * (Number(cart.coupon.discountValue) / 100);
      } else {
        discount = Number(cart.coupon.discountValue);
      }
    }
  }

  const shipping = Number(cart.shippingMethod?.price ?? 0);
  const taxRate = cart.shippingAddress ? await prisma.taxRate.findFirst({ where: { country: cart.shippingAddress.country, OR: [{ state: cart.shippingAddress.state ?? undefined }, { state: null }], isActive: true } }) : null;
  const tax = Math.max(0, subtotal - discount) * Number(taxRate?.rate ?? 0);
  const total = Math.max(0, subtotal - discount + shipping + tax);

  return prisma.cart.update({
    where: { id: cartId },
    data: {
      subtotalAmount: subtotal,
      discountAmount: discount,
      shippingAmount: shipping,
      taxAmount: tax,
      totalAmount: total,
    },
    include: {
      items: true,
      coupon: true,
      shippingMethod: true,
      shippingAddress: true,
    },
  });
}

export async function createCart(rawBody: unknown) {
  const body = cartCreateSchema.parse(rawBody);
  const cart = await prisma.cart.create({ data: body });
  return recalcCart(cart.id);
}

export async function getCart(cartId: string) {
  return recalcCart(cartId);
}

export async function addCartItem(cartId: string, rawBody: unknown) {
  const body = cartItemCreateSchema.parse(rawBody);
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } });
  if (!cart) throw new AppError(404, "Cart not found", "CART_NOT_FOUND");
  if (cart.status !== "ACTIVE") throw new AppError(400, "Cart is not active", "CART_NOT_ACTIVE");

  const variant = await prisma.productVariant.findUnique({ where: { id: body.variantId }, include: { product: true } });
  if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");

  const existing = cart.items.find((i) => i.variantId === body.variantId);
  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + body.quantity } });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId,
        variantId: body.variantId,
        quantity: body.quantity,
        unitPrice: variant.price,
        salePrice: variant.salePrice,
        skuSnapshot: variant.sku,
        titleSnapshot: variant.title ?? "Variant",
        productNameSnapshot: variant.product.name,
      },
    });
  }

  return recalcCart(cartId);
}

export async function updateCartItem(cartId: string, itemId: string, rawBody: unknown) {
  const body = cartItemUpdateSchema.parse(rawBody);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw new AppError(404, "Cart item not found", "CART_ITEM_NOT_FOUND");
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: body.quantity } });
  return recalcCart(cartId);
}

export async function removeCartItem(cartId: string, itemId: string) {
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
  return recalcCart(cartId);
}

export async function applyCoupon(cartId: string, rawBody: unknown) {
  const body = applyCouponSchema.parse(rawBody);
  const coupon = await prisma.coupon.findUnique({ where: { code: body.code } });
  if (!coupon || !coupon.isActive) throw new AppError(404, "Coupon not found or inactive", "COUPON_INVALID");

  await prisma.cart.update({ where: { id: cartId }, data: { couponId: coupon.id } });
  return recalcCart(cartId);
}

function generateOrderNumber() {
  const base = Date.now().toString().slice(-8);
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `${base}${rnd}`;
}

async function recordOrderEvent(orderId: string, actorId: string | undefined, eventType: string, previousValue?: string, nextValue?: string, details?: object) {
  await prisma.orderEvent.create({ data: { orderId, actorId, eventType, previousValue, nextValue, details } });
}

export async function checkoutCart(cartId: string, rawBody: unknown) {
  const body = checkoutSchema.parse(rawBody);
  const cart = await recalcCart(cartId);

  if (cart.status !== "ACTIVE") throw new AppError(400, "Cart is not active", "CART_NOT_ACTIVE");
  if (cart.items.length === 0) throw new AppError(400, "Cart is empty", "CART_EMPTY");

  const shippingAddress = await prisma.address.create({ data: body.shippingAddress });
  const billingAddress = body.billingAddress ? await prisma.address.create({ data: body.billingAddress }) : shippingAddress;

  let customerId = body.customerId;
  if (!customerId) {
    const existing = await prisma.customer.findUnique({ where: { email: body.email } });
    if (existing) customerId = existing.id;
  }
  if (!customerId) {
    const c = await prisma.customer.create({ data: { email: body.email, status: "ACTIVE" } });
    customerId = c.id;
  }

  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    await tx.cart.update({
      where: { id: cartId },
      data: {
        status: "CHECKED_OUT",
        customerId,
        shippingAddressId: shippingAddress.id,
      },
    });

    const created = await tx.order.create({
      data: {
        orderNumber,
        cartId,
        customerId,
        status: "PLACED",
        paymentStatus: "PENDING",
        fulfillmentStatus: "UNFULFILLED",
        currency: cart.currency,
        couponId: cart.couponId,
        shippingMethodId: cart.shippingMethodId,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
        subtotalAmount: cart.subtotalAmount,
        discountAmount: cart.discountAmount,
        shippingAmount: cart.shippingAmount,
        taxAmount: cart.taxAmount,
        totalAmount: cart.totalAmount,
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            productId: null,
            sku: item.skuSnapshot,
            productName: item.productNameSnapshot,
            variantTitle: item.titleSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            salePrice: item.salePrice,
            lineTotal: Number(item.salePrice ?? item.unitPrice) * item.quantity,
          })),
        },
        notes: body.notes ? { create: { note: body.notes, isInternal: false } } : undefined,
      },
      include: { items: true },
    });

    await tx.paymentTransaction.create({
      data: {
        orderId: created.id,
        provider: "manual",
        referenceId: body.paymentReference,
        amount: cart.totalAmount,
        status: "PENDING",
      },
    });

    await tx.customer.update({
      where: { id: customerId! },
      data: {
        lastOrderAt: new Date(),
        lifetimeValue: { increment: Number(cart.totalAmount) },
      },
    });

    await tx.customerOrder.create({
      data: {
        customerId: customerId!,
        orderNumber,
        status: "PLACED",
        totalAmount: cart.totalAmount,
      },
    });

    return created;
  });

  await recordOrderEvent(order.id, undefined, "ORDER_PLACED", undefined, "PLACED", { source: "checkout" });

  return prisma.order.findUnique({
    where: { id: order.id },
    include: {
      customer: true,
      items: true,
      notes: true,
      events: { orderBy: { createdAt: "desc" } },
      payments: true,
      refunds: true,
      cancellation: true,
      shippingAddress: true,
      billingAddress: true,
    },
  });
}

export async function listOrders(rawQuery: unknown) {
  const query = orderListQuerySchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;
  const take = query.perPage;

  const where = {
    ...(query.q
      ? {
          OR: [
            { orderNumber: { contains: query.q, mode: "insensitive" as const } },
            { customer: { email: { contains: query.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.fulfillmentStatus ? { fulfillmentStatus: query.fulfillmentStatus } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy]: query.sortDir },
      include: {
        customer: true,
        items: { take: 3 },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return toPaginatedResponse(items, total, query);
}

export async function getOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: true,
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { email: true } } } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { email: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" }, include: { processedBy: { select: { email: true } } } },
      cancellation: { include: { cancelledBy: { select: { email: true } } } },
      shippingAddress: true,
      billingAddress: true,
      shippingMethod: true,
      coupon: true,
    },
  });

  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  return order;
}

const storefrontItemResolverSchema = z.object({
  items: z.array(z.object({
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
});

export async function resolveStorefrontItems(rawBody: unknown) {
  const body = storefrontItemResolverSchema.parse(rawBody);
  const resolved = [];

  for (const item of body.items) {
    const variant = await prisma.productVariant.findFirst({
      where: {
        isActive: true,
        product: {
          status: "ACTIVE",
          visibility: "PUBLIC",
          name: { equals: item.productName, mode: "insensitive" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!variant) {
      throw new AppError(400, `No active variant found for ${item.productName}`, "CHECKOUT_VARIANT_NOT_FOUND");
    }

    resolved.push({
      productName: item.productName,
      quantity: item.quantity,
      variantId: variant.id,
    });
  }

  return { items: resolved };
}

export async function getStoreOrderById(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items,
    payments: order.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      referenceId: p.referenceId,
      status: p.status,
      amount: p.amount,
      createdAt: p.createdAt,
    })),
  };
}

export async function updateOrderStatus(orderId: string, rawBody: unknown, actorId?: string) {
  const body = orderStatusUpdateSchema.parse(rawBody);
  const order = await getOrder(orderId);
  const updated = await prisma.order.update({ where: { id: orderId }, data: { status: body.value as any } });
  await recordOrderEvent(orderId, actorId, "ORDER_STATUS_UPDATED", order.status, updated.status, { reason: body.reason });
  return updated;
}

export async function updatePaymentStatus(orderId: string, rawBody: unknown, actorId?: string) {
  const body = orderStatusUpdateSchema.parse(rawBody);
  const order = await getOrder(orderId);
  const updated = await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: body.value as any } });
  await prisma.paymentTransaction.create({
    data: {
      orderId,
      provider: "manual",
      amount: order.totalAmount,
      status: body.value as any,
      referenceId: `manual-${Date.now()}`,
    },
  });
  await recordOrderEvent(orderId, actorId, "PAYMENT_STATUS_UPDATED", order.paymentStatus, updated.paymentStatus, { reason: body.reason });
  return updated;
}

export async function updateFulfillmentStatus(orderId: string, rawBody: unknown, actorId?: string) {
  const body = orderStatusUpdateSchema.parse(rawBody);
  const order = await getOrder(orderId);
  const updated = await prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: body.value as any } });
  await recordOrderEvent(orderId, actorId, "FULFILLMENT_STATUS_UPDATED", order.fulfillmentStatus, updated.fulfillmentStatus, { reason: body.reason });
  return updated;
}

export async function addOrderNote(orderId: string, rawBody: unknown, authorId?: string) {
  const body = orderNoteSchema.parse(rawBody);
  await getOrder(orderId);
  const note = await prisma.orderNote.create({ data: { orderId, authorId, note: body.note, isInternal: body.isInternal } });
  await recordOrderEvent(orderId, authorId, "ORDER_NOTE_ADDED", undefined, undefined, { noteId: note.id });
  return note;
}

export async function cancelOrder(orderId: string, rawBody: unknown, actorId?: string) {
  const body = orderCancelSchema.parse(rawBody);
  const order = await getOrder(orderId);
  if (order.status === "CANCELLED") throw new AppError(400, "Order already cancelled", "ORDER_ALREADY_CANCELLED");

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", fulfillmentStatus: "CANCELLED", cancelledAt: new Date() } });
    await tx.orderCancellation.upsert({ where: { orderId }, update: { reason: body.reason, cancelledById: actorId }, create: { orderId, reason: body.reason, cancelledById: actorId } });
    return next;
  });

  await recordOrderEvent(orderId, actorId, "ORDER_CANCELLED", order.status, updated.status, { reason: body.reason });
  return updated;
}

export async function createRefund(orderId: string, rawBody: unknown, actorId?: string) {
  const body = refundSchema.parse(rawBody);
  const order = await getOrder(orderId);
  if (body.amount > Number(order.totalAmount)) throw new AppError(400, "Refund exceeds order total", "INVALID_REFUND_AMOUNT");

  const refund = await prisma.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        orderId,
        processedById: actorId,
        amount: body.amount,
        reason: body.reason,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    const existingRefunded = order.refunds.reduce((sum, r) => sum + Number(r.amount), 0) + body.amount;
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: existingRefunded >= Number(order.totalAmount) ? "REFUNDED" : "PARTIALLY_REFUNDED",
        status: existingRefunded >= Number(order.totalAmount) ? "REFUNDED" : order.status,
        refundedAt: existingRefunded >= Number(order.totalAmount) ? new Date() : null,
      },
    });

    return created;
  });

  await recordOrderEvent(orderId, actorId, "ORDER_REFUNDED", undefined, undefined, { amount: body.amount, reason: body.reason });
  return refund;
}
