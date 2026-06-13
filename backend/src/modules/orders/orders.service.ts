import { prisma } from "../../lib/prisma.js";
import {
  applyCouponSchema,
  cartCreateSchema,
  cartItemCreateSchema,
  cartQuoteSchema,
  cartItemUpdateSchema,
  checkoutSchema,
  deleteAllOrdersSchema,
  orderCancelSchema,
  orderListQuerySchema,
  orderNoteSchema,
  orderStatusUpdateSchema,
  refundSchema,
} from "./orders.schemas.js";
import { AppError } from "../../lib/errors.js";
import { toPaginatedResponse } from "../../lib/pagination.js";
import { env } from "../../config/env.js";
import { z } from "zod";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";
import { sendEmail } from "../notifications/notification.service.js";
import { isWarehouseCollectionOrder, shouldSendWarehouseCollectionReadyEmail } from "./order-collection-email.js";
import { summarizeInventoryRestore } from "./order-danger-zone.js";
import { verifyAdminPassword } from "../auth/auth.service.js";
import { shouldSendOrderConfirmation } from "./order-email-policy.js";

const shippingRulesSchema = z.object({
  freeShippingEnabled: z.boolean().default(false),
  freeShippingThreshold: z.coerce.number().nonnegative().default(0),
});

async function getShippingRules() {
  const existing = await prisma.setting.findUnique({ where: { scope_key: { scope: "shipping", key: "rules" } } });
  return shippingRulesSchema.parse(existing?.value ?? {});
}

type CollectionAddress = {
  line1: string;
  line2?: string | null;
  suburb?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
};

function asCollectionAddress(value: unknown): CollectionAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const address = value as Record<string, unknown>;
  if (typeof address.line1 !== "string" || typeof address.city !== "string" || typeof address.postalCode !== "string" || typeof address.country !== "string") return null;
  return address as CollectionAddress;
}

function isShippingMethodApplicable(method: { isActive: boolean }) {
  return method.isActive;
}

async function calculatePricing(input: {
  items: Array<{ unitPrice: number; salePrice?: number | null; quantity: number }>;
  coupon?: { isActive: boolean; minimumAmount?: number | null; discountType: string; discountValue: number } | null;
  shippingMethod?: { id: string; isActive: boolean; price: number } | null;
  destination?: { country?: string | null; state?: string | null } | null;
}) {
  const subtotal = input.items.reduce((sum, item) => sum + Number(item.salePrice ?? item.unitPrice) * item.quantity, 0);
  let discount = 0;
  if (input.coupon && input.coupon.isActive) {
    const minAmt = Number(input.coupon.minimumAmount ?? 0);
    if (subtotal >= minAmt) {
      discount = input.coupon.discountType === "PERCENT"
        ? subtotal * (Number(input.coupon.discountValue) / 100)
        : Number(input.coupon.discountValue);
    }
  }

  const rules = await getShippingRules();
  const eligibleSubtotal = Math.max(0, subtotal - discount);
  const shippingMethodValid = input.shippingMethod ? isShippingMethodApplicable(input.shippingMethod) : false;
  let shipping = shippingMethodValid ? Number(input.shippingMethod?.price ?? 0) : 0;
  const freeShippingApplied = rules.freeShippingEnabled && Number(rules.freeShippingThreshold) > 0 && eligibleSubtotal >= Number(rules.freeShippingThreshold) && shipping > 0;
  if (freeShippingApplied) {
    shipping = 0;
    console.info("[shipping] free-shipping rule applied", { eligibleSubtotal, threshold: rules.freeShippingThreshold });
  }
  const taxRate = input.destination?.country
    ? await prisma.taxRate.findFirst({
      where: {
        country: input.destination.country,
        OR: [{ state: input.destination.state ?? undefined }, { state: null }],
        isActive: true,
      },
    })
    : null;
  const tax = eligibleSubtotal * Number(taxRate?.rate ?? 0);
  const total = Math.max(0, eligibleSubtotal + shipping + tax);
  const freeShippingRemaining = rules.freeShippingEnabled && Number(rules.freeShippingThreshold) > 0 ? Math.max(0, Number(rules.freeShippingThreshold) - eligibleSubtotal) : null;

  return {
    subtotalAmount: subtotal,
    discountAmount: discount,
    shippingAmount: shipping,
    taxAmount: tax,
    totalAmount: total,
    shippingMethodValid,
    freeShippingEnabled: rules.freeShippingEnabled,
    freeShippingThreshold: Number(rules.freeShippingThreshold),
    freeShippingRemaining,
    freeShippingApplied,
  };
}

async function recalcCart(cartId: string) {
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true, coupon: true, shippingMethod: true, shippingAddress: true } });
  if (!cart) throw new AppError(404, "Cart not found", "CART_NOT_FOUND");
  const pricing = await calculatePricing({
    items: cart.items.map((item) => ({ unitPrice: Number(item.unitPrice), salePrice: item.salePrice ? Number(item.salePrice) : null, quantity: item.quantity })),
    coupon: cart.coupon
      ? { isActive: cart.coupon.isActive, minimumAmount: Number(cart.coupon.minimumAmount ?? 0), discountType: cart.coupon.discountType, discountValue: Number(cart.coupon.discountValue) }
      : null,
    shippingMethod: cart.shippingMethod
      ? { id: cart.shippingMethod.id, isActive: cart.shippingMethod.isActive, price: Number(cart.shippingMethod.price) }
      : null,
    destination: cart.shippingMethod?.type === "COLLECTION"
      ? asCollectionAddress(cart.shippingMethod.collectionAddress)
      : cart.shippingAddress
        ? { country: cart.shippingAddress.country, state: cart.shippingAddress.state }
        : null,
  });
  if (cart.shippingMethodId && !pricing.shippingMethodValid) {
    console.info("[shipping] invalid shipping method cleared from cart", { cartId, shippingMethodId: cart.shippingMethodId });
  }

  return prisma.cart.update({
    where: { id: cartId },
    data: {
      shippingMethodId: cart.shippingMethodId && !pricing.shippingMethodValid ? null : cart.shippingMethodId,
      subtotalAmount: pricing.subtotalAmount,
      discountAmount: pricing.discountAmount,
      shippingAmount: pricing.shippingAmount,
      taxAmount: pricing.taxAmount,
      totalAmount: pricing.totalAmount,
    },
    include: {
      items: true,
      coupon: true,
      shippingMethod: true,
      shippingAddress: true,
    },
  });
}

async function touchCartActivity(cartId: string) {
  const now = new Date();
  await prisma.cart.update({
    where: { id: cartId },
    data: {
      lastActivityAt: now,
      abandonedAt: null,
      reminderSentAt: null,
      clearedAt: null,
      status: "ACTIVE",
    },
  });
  await prisma.abandonedCart.updateMany({
    where: { id: cartId, recoveredAt: null },
    data: { recoveredAt: now },
  });
}

async function adjustReservedStock(tx: any, variantId: string, delta: number, cartId: string) {
  if (delta === 0) return;
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    include: { inventoryLevel: true },
  });
  if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");

  const level = variant.inventoryLevel ?? await tx.inventoryLevel.create({ data: { variantId, quantityOnHand: 0, reservedQuantity: 0 } });
  const nextReserved = level.reservedQuantity + delta;
  if (nextReserved < 0) throw new AppError(400, "Invalid stock release", "STOCK_RELEASE_INVALID");

  const available = level.quantityOnHand - level.reservedQuantity;
  if (delta > 0 && available < delta && !variant.allowBackorder) {
    throw new AppError(400, "Insufficient stock available", "INSUFFICIENT_STOCK");
  }

  await tx.inventoryLevel.update({
    where: { variantId },
    data: { reservedQuantity: nextReserved },
  });

  await tx.stockMovement.create({
    data: {
      variantId,
      movementType: delta > 0 ? "ORDER_RESERVE" : "ORDER_RELEASE",
      quantityDelta: 0,
      quantityBefore: level.quantityOnHand,
      quantityAfter: level.quantityOnHand,
      reason: delta > 0 ? "Cart reservation" : "Cart reservation release",
      referenceType: "cart",
      referenceId: cartId,
    },
  });
}

export async function createCart(rawBody: unknown) {
  const body = cartCreateSchema.parse(rawBody);
  const cart = await prisma.cart.create({ data: body });
  return recalcCart(cart.id);
}

export async function listStoreShippingMethods() {
  const rules = await prisma.setting.findUnique({ where: { scope_key: { scope: "shipping", key: "rules" } } });
  const manualEnabled = (rules?.value as Record<string, unknown> | null)?.manualShippingEnabled !== false;
  if (!manualEnabled) return [];
  return prisma.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
    select: { id: true, name: true, price: true, description: true, type: true, collectionAddress: true },
  });
}

export async function listStoreShippingMethodsForDestination(country?: string, state?: string) {
  const methods = await listStoreShippingMethods();
  console.info("[shipping] methods returned without location filtering", { country, state, count: methods.length });
  return methods;
}

export async function quoteCart(rawBody: unknown) {
  const body = cartQuoteSchema.parse(rawBody);
  const variants = await prisma.productVariant.findMany({ where: { id: { in: body.items.map((i) => i.variantId) } } });
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const resolvedItems = body.items.map((item) => {
    const variant = variantMap.get(item.variantId);
    if (!variant) throw new AppError(404, "Variant not found in quote", "VARIANT_NOT_FOUND");
    return { unitPrice: Number(variant.price), salePrice: variant.salePrice ? Number(variant.salePrice) : null, quantity: item.quantity };
  });
  const shippingMethod = body.shippingMethodId ? await prisma.shippingMethod.findUnique({ where: { id: body.shippingMethodId } }) : null;
  const pricing = await calculatePricing({
    items: resolvedItems,
    shippingMethod: shippingMethod ? { id: shippingMethod.id, isActive: shippingMethod.isActive, price: Number(shippingMethod.price) } : null,
    destination: shippingMethod?.type === "COLLECTION"
      ? asCollectionAddress(shippingMethod.collectionAddress)
      : body.shippingAddress
        ? { country: body.shippingAddress.country, state: body.shippingAddress.state }
        : null,
  });
  const methods = await listStoreShippingMethodsForDestination(body.shippingAddress?.country, body.shippingAddress?.state);
  return {
    ...pricing,
    shippingMethodId: pricing.shippingMethodValid ? body.shippingMethodId ?? null : null,
    shippingMethodInvalid: !!body.shippingMethodId && !pricing.shippingMethodValid,
    shippingMethods: methods,
  };
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
  await prisma.$transaction(async (tx) => {
    await adjustReservedStock(tx, body.variantId, body.quantity, cartId);
    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + body.quantity } });
    } else {
      await tx.cartItem.create({
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
  });
  await touchCartActivity(cartId);

  return recalcCart(cartId);
}

export async function updateCartItem(cartId: string, itemId: string, rawBody: unknown) {
  const body = cartItemUpdateSchema.parse(rawBody);
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw new AppError(404, "Cart item not found", "CART_ITEM_NOT_FOUND");
  const delta = body.quantity - item.quantity;
  await prisma.$transaction(async (tx) => {
    await adjustReservedStock(tx, item.variantId, delta, cartId);
    await tx.cartItem.update({ where: { id: itemId }, data: { quantity: body.quantity } });
  });
  await touchCartActivity(cartId);
  return recalcCart(cartId);
}

export async function removeCartItem(cartId: string, itemId: string) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (item) {
    await prisma.$transaction(async (tx) => {
      await adjustReservedStock(tx, item.variantId, -item.quantity, cartId);
      await tx.cartItem.delete({ where: { id: item.id } });
    });
  }
  await touchCartActivity(cartId);
  return recalcCart(cartId);
}

export async function applyCoupon(cartId: string, rawBody: unknown) {
  const body = applyCouponSchema.parse(rawBody);
  const coupon = await prisma.coupon.findUnique({ where: { code: body.code } });
  if (!coupon || !coupon.isActive) throw new AppError(404, "Coupon not found or inactive", "COUPON_INVALID");

  await prisma.cart.update({ where: { id: cartId }, data: { couponId: coupon.id } });
  await touchCartActivity(cartId);
  return recalcCart(cartId);
}

function generateOrderNumber() {
  const base = Date.now().toString().slice(-8);
  const rnd = Math.floor(Math.random() * 900 + 100);
  return `${base}${rnd}`;
}


async function sendOrderConfirmationEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, items: true, shippingMethod: true },
  });
  const recipientEmail = order?.customer?.email ?? (order as any)?.guestEmail;
  if (!recipientEmail || !shouldSendOrderConfirmation(order!.paymentStatus)) return;
  const orderItems = order!.items.map((item) => `${item.productName} x${item.quantity}`).join(", ");
  const isCollection = isWarehouseCollectionOrder(order!);
  const templateKey = isCollection ? "collection_order_confirmation" : "order_confirmation";
  const placeholders: Record<string, string> = {
    firstName: order!.customer?.firstName ?? "Customer",
    orderNumber: order.orderNumber,
    orderDate: order.createdAt.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }),
    orderItems: orderItems || "—",
    orderTotal: `${order.currency} ${Number(order.totalAmount).toFixed(2)}`,
  };
  if (isCollection) {
    placeholders.estimatedCollectionTime = order.collectionDate
      ? order.collectionDate.toLocaleString("en-ZA", {
          timeZone: "Africa/Johannesburg",
          weekday: "long", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", hour12: false,
        })
      : "To be confirmed";
  }
  const template = await resolveTemplateByKey(templateKey, placeholders);
  await sendEmail({ to: recipientEmail, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, orderId } });
}

function formatCollectionWindow(order: { collectionWindowStart?: Date | null; collectionWindowEnd?: Date | null }): string {
  if (!order.collectionWindowStart) return "Contact us for collection time";
  const tz = "Africa/Johannesburg";
  const dateOpts: Intl.DateTimeFormatOptions = { timeZone: tz, weekday: "long", month: "long", day: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false };
  const datePart = order.collectionWindowStart.toLocaleDateString("en-ZA", dateOpts);
  const startTime = order.collectionWindowStart.toLocaleTimeString("en-ZA", timeOpts);
  if (!order.collectionWindowEnd) return `${datePart} from ${startTime}`;
  const endTime = order.collectionWindowEnd.toLocaleTimeString("en-ZA", timeOpts);
  return `${datePart}, ${startTime}–${endTime}`;
}

async function sendWarehouseCollectionReadyEmail(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, shippingMethod: true },
  });
  if (!order?.customer?.email || !isWarehouseCollectionOrder(order)) return false;

  const alreadySent = await prisma.orderEvent.findFirst({
    where: { orderId, eventType: "COLLECTION_READY_EMAIL_SENT" },
    select: { id: true },
  });
  if (alreadySent) return false;

  const template = await resolveTemplateByKey("warehouse_collection_ready", {
    firstName: order.customer.firstName ?? "there",
    orderNumber: order.orderNumber,
    collectionWindow: formatCollectionWindow(order),
    orderUrl: `${env.STOREFRONT_URL ?? ""}/account/orders/${order.id}`,
  });
  await sendEmail({
    to: order.customer.email,
    subject: template.subject,
    html: template.htmlBody,
    meta: { templateKey: template.key, orderId: order.id, fulfillmentStatus: "PACKED" },
  });
  await recordOrderEvent(order.id, undefined, "COLLECTION_READY_EMAIL_SENT", undefined, "SENT", { templateKey: template.key });
  return true;
}

async function sendAdminNewOrderEmail(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  const adminEmail = env.ADMIN_EMAIL ?? env.EMAIL_FROM;
  if (!adminEmail || !order) return;
  const template = await resolveTemplateByKey("admin_new_order_notification", {
    orderNumber: order.orderNumber,
    orderDate: order.createdAt.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }),
    orderTotal: `${order.currency} ${Number(order.totalAmount).toFixed(2)}`,
  });
  await sendEmail({ to: adminEmail, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, orderId } });
}

export async function sendOrderConfirmationEmailSafe(orderId: string) {
  await sendOrderConfirmationEmail(orderId).catch((err) => console.warn("[email] order confirmation send failed", err));
}

async function sendAdminNewOrderEmailSafe(orderId: string) {
  await sendAdminNewOrderEmail(orderId).catch((err) => console.warn("[email] admin new order send failed", err));
}

async function sendReadyForCollectionEmail(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order?.customer?.email) return;
  const template = await resolveTemplateByKey("warehouse_collection_ready", {
    firstName: order.customer.firstName ?? "there",
    orderNumber: order.orderNumber,
    collectionWindow: formatCollectionWindow(order),
    orderUrl: `${env.STOREFRONT_URL ?? ""}/account/orders/${order.id}`,
  });
  await sendEmail({ to: order.customer.email, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, orderId } });
}

async function sendShippingEmail(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order?.customer?.email || !order.trackingNumber) return;
  const isPudo = order.courier?.toLowerCase().includes("pudo") ?? false;
  const template = await resolveTemplateByKey("shipping_confirmation", {
    orderNumber: order.orderNumber,
    carrier: order.courier ?? "Carrier",
    trackingNumber: order.trackingNumber,
    pudoLockerName: order.pudoLockerName ?? null,
    trackingUrl: isPudo ? `https://pudo.co.za/track/${order.trackingNumber}` : null,
  });
  await sendEmail({ to: order.customer.email, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, orderId } });
}

async function recordOrderEvent(orderId: string, actorId: string | undefined, eventType: string, previousValue?: string, nextValue?: string, details?: object) {
  await prisma.orderEvent.create({ data: { orderId, actorId, eventType, previousValue, nextValue, details } });
}

export async function checkoutCart(cartId: string, rawBody: unknown, authenticatedCustomerId: string | null) {
  const checkoutStartedAt = Date.now();
  const body = checkoutSchema.parse(rawBody);
  const existingCart = await prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } });
  if (!existingCart) throw new AppError(404, "Cart not found", "CART_NOT_FOUND");

  if (existingCart.status !== "ACTIVE") throw new AppError(400, "Cart is not active", "CART_NOT_ACTIVE");
  if (existingCart.items.length === 0) throw new AppError(400, "Cart is empty", "CART_EMPTY");

  const selectedShippingMethod = body.shippingMethodId
    ? await prisma.shippingMethod.findFirst({ where: { id: body.shippingMethodId, isActive: true } })
    : null;
  const isCollection = selectedShippingMethod?.type === "COLLECTION";
  const collectionAddress = isCollection ? asCollectionAddress(selectedShippingMethod.collectionAddress) : null;
  if (isCollection && !collectionAddress) {
    throw new AppError(400, "This collection method does not have a valid collection address", "COLLECTION_ADDRESS_REQUIRED");
  }

  const isLockerDelivery = body.pudoDeliveryType === "locker";
  if (!isLockerDelivery && !isCollection && !body.shippingAddress) {
    throw new AppError(400, "Shipping address is required", "SHIPPING_ADDRESS_REQUIRED");
  }
  const shippingAddress = !isCollection && body.shippingAddress
    ? await prisma.address.create({ data: body.shippingAddress })
    : null;
  const billingAddress = body.billingAddress
    ? await prisma.address.create({ data: body.billingAddress })
    : shippingAddress;
  console.info("[checkout] incoming shipping selection", {
    cartId,
    incomingShippingAddressId: shippingAddress?.id ?? null,
    incomingShippingMethodId: body.shippingMethodId ?? null,
  });
  await prisma.cart.update({
    where: { id: cartId },
    data: {
      shippingAddressId: isCollection ? null : shippingAddress?.id ?? existingCart.shippingAddressId,
      shippingMethodId: body.shippingMethodId ?? existingCart.shippingMethodId,
    },
  });
  const cart = await recalcCart(cartId);
  const checkoutPricing = await calculatePricing({
    items: cart.items.map((item) => ({ unitPrice: Number(item.unitPrice), salePrice: item.salePrice ? Number(item.salePrice) : null, quantity: item.quantity })),
    coupon: cart.coupon
      ? { isActive: cart.coupon.isActive, minimumAmount: Number(cart.coupon.minimumAmount ?? 0), discountType: cart.coupon.discountType, discountValue: Number(cart.coupon.discountValue) }
      : null,
    shippingMethod: cart.shippingMethod
      ? { id: cart.shippingMethod.id, isActive: cart.shippingMethod.isActive, price: Number(cart.shippingMethod.price) }
      : null,
    destination: isCollection
      ? collectionAddress
      : cart.shippingAddress
        ? { country: cart.shippingAddress.country, state: cart.shippingAddress.state }
        : null,
  });
  const isPudoShipping = typeof body.pudoShippingAmount === "number";
  if (!checkoutPricing.freeShippingApplied && !cart.shippingMethodId && !isPudoShipping) {
    throw new AppError(400, "Please select a shipping method to continue.", "SHIPPING_METHOD_REQUIRED");
  }
  console.info("[checkout-timing] shipping/totals calculation complete", {
    cartId,
    elapsedMs: Date.now() - checkoutStartedAt,
  });
  console.info("[checkout] finalized cart totals before order create", {
    cartId: cart.id,
    persistedShippingAddressId: cart.shippingAddressId,
    persistedShippingMethodId: cart.shippingMethodId,
    subtotalAmount: Number(cart.subtotalAmount),
    shippingAmount: Number(cart.shippingAmount),
    taxAmount: Number(cart.taxAmount),
    discountAmount: Number(cart.discountAmount),
    totalAmount: Number(cart.totalAmount),
    shippingMethodId: cart.shippingMethodId,
  });

  const customerId = authenticatedCustomerId;
  const guestEmail = !customerId ? body.email : undefined;
  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new AppError(401, "Customer authentication required", "UNAUTHORIZED");
  }

  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    await tx.cart.update({
      where: { id: cartId },
      data: {
        status: "CHECKED_OUT",
        customerId,
        ...(shippingAddress ? { shippingAddressId: shippingAddress.id } : {}),
        abandonedAt: null,
        reminderSentAt: null,
        clearedAt: null,
      },
    });

    const created = await tx.order.create({
      data: {
        orderNumber,
        cartId,
        customerId,
        guestEmail: guestEmail ?? null,
        status: "AWAITING_PAYMENT",
        paymentStatus: "AWAITING_PAYMENT",
        fulfillmentStatus: "UNFULFILLED",
        currency: cart.currency,
        couponId: cart.couponId,
        shippingMethodId: cart.shippingMethodId,
        shippingAddressId: shippingAddress?.id ?? null,
        billingAddressId: billingAddress?.id ?? null,
        collectionAddress: collectionAddress ?? undefined,
        pudoLockerCode: body.pudoLockerCode ?? null,
        pudoLockerName: body.pudoLockerName ?? null,
        pudoLockerAddress: body.pudoLockerAddress ?? null,
        pudoDeliveryType: body.pudoDeliveryType ?? null,
        subtotalAmount: cart.subtotalAmount,
        discountAmount: cart.discountAmount,
        shippingAmount: isPudoShipping ? body.pudoShippingAmount! : cart.shippingAmount,
        taxAmount: cart.taxAmount,
        totalAmount: isPudoShipping
          ? Number(cart.subtotalAmount) - Number(cart.discountAmount) + body.pudoShippingAmount! + Number(cart.taxAmount)
          : cart.totalAmount,
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

    const finalTotal = isPudoShipping
      ? Number(cart.subtotalAmount) - Number(cart.discountAmount) + body.pudoShippingAmount! + Number(cart.taxAmount)
      : Number(cart.totalAmount);
    await tx.paymentTransaction.create({
      data: {
        orderId: created.id,
        provider: "stitch",
        referenceId: body.paymentReference,
        amount: finalTotal,
        status: "AWAITING_PAYMENT",
      },
    });

    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          lastOrderAt: new Date(),
          lifetimeValue: { increment: finalTotal },
        },
      });

      await tx.customerOrder.create({
        data: {
          customerId,
          orderNumber,
          status: "AWAITING_PAYMENT",
          totalAmount: cart.totalAmount,
        },
      });
    }

    return created;
  });
  console.info("[checkout-timing] order creation/update complete", {
    cartId,
    orderId: order.id,
    elapsedMs: Date.now() - checkoutStartedAt,
  });

  await recordOrderEvent(order.id, undefined, "ORDER_PLACED", undefined, "AWAITING_PAYMENT", { source: "checkout" });
  await sendAdminNewOrderEmailSafe(order.id);

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
      shippingMethod: true,
    },
  });
}

export async function deleteAllOrdersAndRestoreStock(rawBody: unknown, actorId: string) {
  const parsed = deleteAllOrdersSchema.parse(rawBody);
  await verifyAdminPassword(actorId, parsed.password);

  return prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      select: {
        id: true,
        orderNumber: true,
        cartId: true,
        items: { select: { variantId: true, quantity: true } },
        cart: { select: { items: { select: { variantId: true, quantity: true } } } },
      },
    });

    if (orders.length === 0) {
      return { deletedOrders: 0, restoredUnits: 0, affectedVariants: 0 };
    }

    const stockToRestore = summarizeInventoryRestore(orders.flatMap((order) => order.items));
    const reservationsToRelease = summarizeInventoryRestore(
      orders.flatMap((order) => order.cart?.items ?? []),
    );
    const restockableVariants = await tx.productVariant.findMany({
      where: { id: { in: [...stockToRestore.keys()] } },
      select: { id: true },
    });
    const restockableVariantIds = new Set(restockableVariants.map((variant) => variant.id));
    for (const variantId of stockToRestore.keys()) {
      if (!restockableVariantIds.has(variantId)) stockToRestore.delete(variantId);
    }

    for (const [variantId, quantity] of stockToRestore) {
      const current = await tx.inventoryLevel.findUnique({ where: { variantId } });
      const quantityBefore = current?.quantityOnHand ?? 0;
      const reservedBefore = current?.reservedQuantity ?? 0;
      const quantityAfter = quantityBefore + quantity;
      const reservedQuantity = Math.max(0, reservedBefore - (reservationsToRelease.get(variantId) ?? 0));

      await tx.inventoryLevel.upsert({
        where: { variantId },
        create: { variantId, quantityOnHand: quantityAfter, reservedQuantity },
        update: { quantityOnHand: quantityAfter, reservedQuantity },
      });
      await tx.stockMovement.create({
        data: {
          variantId,
          movementType: "RETURN_RESTOCK",
          quantityDelta: quantity,
          quantityBefore,
          quantityAfter,
          reason: `Danger zone: restored stock while deleting all orders (${orders.length} orders)`,
          referenceType: "bulk_order_delete",
          createdById: actorId,
        },
      });
    }

    const orderNumbers = orders.map((order) => order.orderNumber);
    const cartIds = orders.flatMap((order) => order.cartId ? [order.cartId] : []);

    await tx.customerOrder.deleteMany({ where: { orderNumber: { in: orderNumbers } } });
    const deleted = await tx.order.deleteMany({ where: { id: { in: orders.map((order) => order.id) } } });
    if (cartIds.length > 0) {
      await tx.cart.updateMany({
        where: { id: { in: cartIds } },
        data: { status: "ABANDONED", clearedAt: new Date() },
      });
    }

    return {
      deletedOrders: deleted.count,
      restoredUnits: [...stockToRestore.values()].reduce((total, quantity) => total + quantity, 0),
      affectedVariants: stockToRestore.size,
    };
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 });
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
    variantId: z.string().cuid().optional(),
    productId: z.string().cuid().optional(),
    slug: z.string().min(1).optional(),
    productName: z.string().min(1).optional(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export async function resolveStorefrontItems(rawBody: unknown) {
  const body = storefrontItemResolverSchema.parse(rawBody);
  const resolved = [];

  for (const item of body.items) {
    let variant = null;
    if (item.variantId) {
      variant = await prisma.productVariant.findFirst({
        where: {
          id: item.variantId,
          isActive: true,
          product: { status: "ACTIVE", visibility: "PUBLIC" },
        },
      });
    }

    if (!variant && item.productId) {
      variant = await prisma.productVariant.findFirst({
        where: {
          productId: item.productId,
          isActive: true,
          product: { status: "ACTIVE", visibility: "PUBLIC" },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!variant && item.slug) {
      variant = await prisma.productVariant.findFirst({
        where: {
          isActive: true,
          product: { status: "ACTIVE", visibility: "PUBLIC", slug: item.slug },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!variant && item.productName) {
      const matches = await prisma.productVariant.findMany({
        where: {
          isActive: true,
          product: {
            status: "ACTIVE",
            visibility: "PUBLIC",
            name: { equals: item.productName, mode: "insensitive" },
          },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, productId: true },
        take: 2,
      });

      if (matches.length > 1 && matches[0].productId !== matches[1].productId) {
        throw new AppError(400, `Ambiguous product name mapping for ${item.productName}`, "CHECKOUT_VARIANT_AMBIGUOUS");
      }
      if (matches.length === 1) {
        variant = await prisma.productVariant.findUnique({ where: { id: matches[0].id } });
      }
    }

    if (!variant) {
      throw new AppError(400, `No active variant found for checkout item`, "CHECKOUT_VARIANT_NOT_FOUND");
    }

    resolved.push({
      productName: item.productName ?? null,
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
      shippingAddress: true,
      shippingMethod: true,
    },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  console.info("[orders] getStoreOrderById", {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    stitchReference: order.stitchReference,
    fulfillmentStatus: order.fulfillmentStatus,
    trackingNumber: order.trackingNumber,
    courier: order.courier,
    pudoLockerCode: order.pudoLockerCode,
    pudoLockerName: order.pudoLockerName,
    pudoLockerAddress: order.pudoLockerAddress,
    pudoDeliveryType: order.pudoDeliveryType,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    currency: order.currency,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    shippingMethod: order.shippingMethod
      ? { id: order.shippingMethod.id, name: order.shippingMethod.name, type: order.shippingMethod.type }
      : null,
    collectionAddress: asCollectionAddress(order.collectionAddress),
    shippingAddress: order.shippingAddress
      ? {
          firstName: order.shippingAddress.firstName,
          lastName: order.shippingAddress.lastName,
          recipientName: order.shippingAddress.recipientName,
          line1: order.shippingAddress.line1,
          line2: order.shippingAddress.line2,
          suburb: order.shippingAddress.suburb,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postalCode: order.shippingAddress.postalCode,
          country: order.shippingAddress.country,
        }
      : null,
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
  if (updated.status === "READY_FOR_COLLECTION") {
    await sendReadyForCollectionEmail(orderId).catch((err) => console.warn("[email] send failed", err));
  }
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
  const collectionReadyEmailAlreadySent = order.events.some((event) => event.eventType === "COLLECTION_READY_EMAIL_SENT");
  const updated = await prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: body.value as any, trackingNumber: body.trackingNumber, courier: body.courier, shippedAt: body.shippedAt, deliveredAt: body.deliveredAt } });
  await recordOrderEvent(orderId, actorId, "FULFILLMENT_STATUS_UPDATED", order.fulfillmentStatus, updated.fulfillmentStatus, { reason: body.reason });
  if ((updated.fulfillmentStatus === "FULFILLED" || updated.fulfillmentStatus === "PARTIALLY_FULFILLED")
    && !isWarehouseCollectionOrder(order)) {
    await sendShippingEmail(orderId).catch(() => undefined);
  }
  if (shouldSendWarehouseCollectionReadyEmail({
    previousFulfillmentStatus: order.fulfillmentStatus,
    nextFulfillmentStatus: updated.fulfillmentStatus,
    isWarehouseCollection: isWarehouseCollectionOrder(order),
    alreadySent: collectionReadyEmailAlreadySent,
  })) {
    await sendWarehouseCollectionReadyEmail(orderId).catch(() => undefined);
  }
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

  const cancelPaymentStatus = order.paymentStatus === "PAID" ? "REFUND_DUE" : "CANCELLED";
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", fulfillmentStatus: "CANCELLED", paymentStatus: cancelPaymentStatus as any, cancelledAt: new Date() } });
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
        paymentStatus: existingRefunded >= Number(order.totalAmount) ? "FAILED" : "PAID",
        status: existingRefunded >= Number(order.totalAmount) ? "CANCELLED" : order.status,
        refundedAt: existingRefunded >= Number(order.totalAmount) ? new Date() : null,
      },
    });

    return created;
  });

  await recordOrderEvent(orderId, actorId, "ORDER_REFUNDED", undefined, undefined, { amount: body.amount, reason: body.reason });

  const refundOrder = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  const refundCustomerEmail = refundOrder?.customer?.email;
  if (refundCustomerEmail && refundOrder) {
    const { orderNumber, currency } = refundOrder;
    resolveTemplateByKey("refund_cancellation", {
      orderNumber,
      eventType: "refunded",
      amount: `${currency} ${body.amount.toFixed(2)}`,
    }).then((template) =>
      sendEmail({ to: refundCustomerEmail, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, orderId } })
    ).catch((err) => console.warn("[email] send failed", err));
  }

  return refund;
}


export async function listCustomerOrders(customerId: string) {
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

export async function getCustomerOrder(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      items: true,
      shippingAddress: true,
      billingAddress: true,
      payments: { orderBy: { createdAt: "desc" } },
      shippingMethod: { select: { id: true, name: true, type: true, collectionAddress: true } },
    },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  return {
    ...order,
    collectionAddress: asCollectionAddress(order.collectionAddress ?? order.shippingMethod?.collectionAddress),
  };
}
