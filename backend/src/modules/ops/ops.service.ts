import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";
import { sendEmail } from "../notifications/notification.service.js";
import {
  bulkCouponActionSchema,
  couponSchema,
  inquiryUpdateSchema,
  newsletterCreateSchema,
  newsletterImportSchema,
  reportRangeSchema,
  shippingMethodSchema,
  taxRateSchema,
  abandonedCartReminderSchema,
  abandonedCartConfigSchema,
  adminShippingMethodCreateSchema,
  adminShippingMethodUpdateSchema,
  shippingRulesSchema,
} from "./ops.schemas.js";

const ABANDONED_SCOPE = "abandoned_cart";
const ABANDONED_KEY = "config";

export async function getAbandonedCartConfig() {
  const existing = await prisma.setting.findUnique({ where: { scope_key: { scope: ABANDONED_SCOPE, key: ABANDONED_KEY } } });
  return abandonedCartConfigSchema.parse(existing?.value ?? {});
}

export async function upsertAbandonedCartConfig(rawBody: unknown) {
  const config = abandonedCartConfigSchema.parse(rawBody);
  await prisma.setting.upsert({
    where: { scope_key: { scope: ABANDONED_SCOPE, key: ABANDONED_KEY } },
    update: { value: config as any },
    create: { scope: ABANDONED_SCOPE, key: ABANDONED_KEY, value: config as any },
  });
  return config;
}

async function releaseReservedStockForCart(tx: any, cartId: string) {
  const items = await tx.cartItem.findMany({ where: { cartId } });
  for (const item of items) {
    const level = await tx.inventoryLevel.findUnique({ where: { variantId: item.variantId } });
    if (!level) continue;
    const nextReserved = Math.max(0, level.reservedQuantity - item.quantity);
    await tx.inventoryLevel.update({ where: { variantId: item.variantId }, data: { reservedQuantity: nextReserved } });
    await tx.stockMovement.create({
      data: {
        variantId: item.variantId,
        movementType: "ORDER_RELEASE",
        quantityDelta: 0,
        quantityBefore: level.quantityOnHand,
        quantityAfter: level.quantityOnHand,
        reason: "Abandoned cart clear release",
        referenceType: "cart",
        referenceId: cartId,
      },
    });
  }
}

export async function processAbandonedCarts(now = new Date()) {
  const lockRows = await prisma.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_lock(93842017) AS acquired`;
  const lockAcquired = Boolean(lockRows?.[0]?.acquired);
  if (!lockAcquired) {
    return { scanned: 0, abandoned: 0, reminded: 0, cleared: 0, skipped: true };
  }

  try {
  const config = await getAbandonedCartConfig();
  if (!config.enabled) return { scanned: 0, abandoned: 0, reminded: 0, cleared: 0 };

  const carts = await prisma.cart.findMany({
    where: { status: "ACTIVE", clearedAt: null },
    include: { items: true, customer: true },
    take: 200,
  });

  let abandoned = 0;
  let reminded = 0;
  let cleared = 0;

  for (const cart of carts) {
    const minutesSinceActivity = (now.getTime() - new Date(cart.lastActivityAt).getTime()) / 60000;
    if (minutesSinceActivity < config.inactivityThresholdMinutes) continue;

    const activeOrder = await prisma.order.findFirst({
      where: {
        cartId: cart.id,
        OR: [
          { paymentStatus: "PAID" },
          { status: "AWAITING_PAYMENT" },
        ],
      },
    });
    if (activeOrder) continue;

    await prisma.cart.update({
      where: { id: cart.id },
      data: { status: "ABANDONED", abandonedAt: cart.abandonedAt ?? now },
    });
    await prisma.abandonedCart.upsert({
      where: { id: cart.id },
      update: {
        customerId: cart.customerId,
        email: cart.customer?.email ?? null,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        totalValue: cart.totalAmount,
      },
      create: {
        id: cart.id,
        customerId: cart.customerId,
        email: cart.customer?.email ?? null,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        totalValue: cart.totalAmount,
      },
    });
    abandoned += 1;

    const abandonedAt = cart.abandonedAt ?? now;
    const minutesSinceAbandoned = (now.getTime() - new Date(abandonedAt).getTime()) / 60000;
    if (config.reminderEnabled && !cart.reminderSentAt && minutesSinceAbandoned >= config.reminderDelayMinutes) {
      try {
        const targetEmail = cart.customer?.email;
        if (targetEmail && cart.customer?.marketingEmailConsent !== false) {
          const template = await resolveTemplateByKey(config.templateKey, {
            firstName: cart.customer?.firstName ?? "there",
            checkoutUrl: `${process.env.STOREFRONT_URL ?? ""}/checkout`,
          });
          await sendEmail({ to: targetEmail, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, cartId: cart.id } });
          await prisma.cart.update({ where: { id: cart.id }, data: { reminderSentAt: now } });
          reminded += 1;
        }
      } catch {
        // non-blocking
      }
    }

    if (minutesSinceAbandoned >= config.clearDelayMinutes && !cart.clearedAt) {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.cart.findUnique({ where: { id: cart.id } });
        if (!fresh || fresh.clearedAt || fresh.status !== "ABANDONED") return;
        await releaseReservedStockForCart(tx, cart.id);
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({ where: { id: cart.id }, data: { clearedAt: now } });
      });
      cleared += 1;
    }
  }

  return { scanned: carts.length, abandoned, reminded, cleared, skipped: false };
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(93842017)`;
  }
}

function getDateRange(rawQuery: unknown) {
  const parsed = reportRangeSchema.parse(rawQuery);
  return {
    from: parsed.from ? new Date(parsed.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: parsed.to ? new Date(parsed.to) : new Date(),
  };
}

export async function getDashboardKpis(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);

  const [ordersCount, revenueAgg, customersCount, inventoryReport, pendingInquiries, abandonedCarts] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: from, lte: to }, paymentStatus: { in: ["PAID"] } } }),
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
    getInventoryReport(),
    prisma.supportInquiry.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.cart.count({ where: { status: "ABANDONED", updatedAt: { gte: from, lte: to } } }),
  ]);

  return {
    dateRange: { from, to },
    ordersCount,
    revenue: Number(revenueAgg._sum.totalAmount ?? 0),
    customersCount,
    lowStockCount: inventoryReport.lowStockCount,
    pendingInquiries,
    abandonedCarts,
  };
}

export async function getSalesReport(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);
  const orders = await prisma.order.findMany({ where: { createdAt: { gte: from, lte: to } }, include: { items: true } });

  const gross = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const discounts = orders.reduce((sum, order) => sum + Number(order.discountAmount), 0);
  const shipping = orders.reduce((sum, order) => sum + Number(order.shippingAmount), 0);
  const taxes = orders.reduce((sum, order) => sum + Number(order.taxAmount), 0);

  return {
    dateRange: { from, to },
    orders: orders.length,
    gross,
    discounts,
    shipping,
    taxes,
    averageOrderValue: orders.length ? gross / orders.length : 0,
  };
}

export async function getOrderReport(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);
  const grouped = await prisma.order.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: from, lte: to } } });
  const paymentGrouped = await prisma.order.groupBy({ by: ["paymentStatus"], _count: { _all: true }, where: { createdAt: { gte: from, lte: to } } });
  return { dateRange: { from, to }, byStatus: grouped, byPaymentStatus: paymentGrouped };
}

export async function getCustomerReport(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);
  const [total, newCustomers, vip, inactive] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.customer.count({ where: { status: "VIP" } }),
    prisma.customer.count({ where: { status: "INACTIVE" } }),
  ]);

  return { dateRange: { from, to }, total, newCustomers, vip, inactive };
}

export async function getInventoryReport() {
  const levels = await prisma.inventoryLevel.findMany({ include: { variant: { select: { id: true, sku: true, product: { select: { id: true, name: true } } } } } });
  const lowStock = levels.filter((l) => l.quantityOnHand <= l.lowStockThreshold);
  const outOfStock = levels.filter((l) => l.quantityOnHand <= 0);
  return { totalTracked: levels.length, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length, lowStockItems: lowStock };
}

export async function getRecentActivity() {
  const [orders, inquiries, stockMovements, paymentEvents] = await Promise.all([
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.supportInquiry.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.paymentEventLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return { orders, inquiries, stockMovements, paymentEvents };
}

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function upsertCoupon(rawBody: unknown) {
  const body = couponSchema.parse(rawBody);
  return prisma.coupon.upsert({
    where: { code: body.code },
    update: {
      description: body.description,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minimumAmount: body.minimumAmount,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      usageLimit: body.usageLimit,
      isActive: body.isActive,
    },
    create: {
      code: body.code,
      description: body.description,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minimumAmount: body.minimumAmount,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      usageLimit: body.usageLimit,
      isActive: body.isActive,
    },
  });
}

export async function bulkCouponAction(rawBody: unknown) {
  const body = bulkCouponActionSchema.parse(rawBody);
  if (body.action === "delete") {
    const deleted = await prisma.coupon.deleteMany({ where: { id: { in: body.ids } } });
    return { affected: deleted.count };
  }
  const updated = await prisma.coupon.updateMany({ where: { id: { in: body.ids } }, data: { isActive: body.action === "activate" } });
  return { affected: updated.count };
}

export async function listShippingMethods() {
  return prisma.shippingMethod.findMany({ orderBy: { name: "asc" } });
}

function shippingCodeFromName(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const prefix = normalized || "SHIPPING";
  return `${prefix}_${Date.now().toString().slice(-6)}`;
}

export async function listAdminShippingMethods() {
  return prisma.shippingMethod.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, price: true, description: true, isActive: true, createdAt: true, updatedAt: true },
  });
}

export async function createAdminShippingMethod(rawBody: unknown) {
  const body = adminShippingMethodCreateSchema.parse(rawBody);
  return prisma.shippingMethod.create({
    data: {
      name: body.name,
      price: body.price,
      isActive: body.isActive,
      description: body.description ?? null,
      code: shippingCodeFromName(body.name),
    },
    select: { id: true, name: true, price: true, description: true, isActive: true, createdAt: true, updatedAt: true },
  });
}

export async function updateAdminShippingMethod(id: string, rawBody: unknown) {
  const body = adminShippingMethodUpdateSchema.parse(rawBody);
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Shipping method not found", "SHIPPING_METHOD_NOT_FOUND");
  return prisma.shippingMethod.update({
    where: { id },
    data: { name: body.name, price: body.price, isActive: body.isActive, description: body.description ?? null },
    select: { id: true, name: true, price: true, description: true, isActive: true, createdAt: true, updatedAt: true },
  });
}

export async function deactivateAdminShippingMethod(id: string) {
  const existing = await prisma.shippingMethod.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Shipping method not found", "SHIPPING_METHOD_NOT_FOUND");
  return prisma.shippingMethod.update({
    where: { id },
    data: { isActive: false },
    select: { id: true, name: true, price: true, description: true, isActive: true, createdAt: true, updatedAt: true },
  });
}

export async function getShippingRules() {
  const existing = await prisma.setting.findUnique({ where: { scope_key: { scope: "shipping", key: "rules" } } });
  return shippingRulesSchema.parse(existing?.value ?? {});
}

export async function upsertShippingRules(rawBody: unknown) {
  const body = shippingRulesSchema.parse(rawBody);
  await prisma.setting.upsert({
    where: { scope_key: { scope: "shipping", key: "rules" } },
    update: { value: body as any },
    create: { scope: "shipping", key: "rules", value: body as any },
  });
  return body;
}

export async function upsertShippingMethod(rawBody: unknown) {
  const body = shippingMethodSchema.parse(rawBody);
  return prisma.shippingMethod.upsert({
    where: { code: body.code },
    update: body,
    create: body,
  });
}

export async function listTaxRates() {
  return prisma.taxRate.findMany({ orderBy: [{ country: "asc" }, { state: "asc" }] });
}

export async function upsertTaxRate(rawBody: unknown) {
  const body = taxRateSchema.parse(rawBody);
  const existing = await prisma.taxRate.findFirst({ where: { country: body.country, state: body.state ?? null, name: body.name } });
  if (existing) {
    return prisma.taxRate.update({ where: { id: existing.id }, data: body });
  }
  return prisma.taxRate.create({ data: body });
}

export async function deleteTaxRate(id: string) {
  return prisma.taxRate.delete({ where: { id } });
}

export async function listInquiries() {
  return prisma.supportInquiry.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, email: true } }, assignedTo: { select: { id: true, email: true } } },
  });
}

export async function updateInquiry(inquiryId: string, rawBody: unknown) {
  const body = inquiryUpdateSchema.parse(rawBody);
  const existing = await prisma.supportInquiry.findUnique({ where: { id: inquiryId } });
  if (!existing) throw new AppError(404, "Inquiry not found", "INQUIRY_NOT_FOUND");
  return prisma.supportInquiry.update({ where: { id: inquiryId }, data: body });
}

export async function listNewsletterSubscribers() {
  return prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createNewsletterSubscriber(rawBody: unknown) {
  const body = newsletterCreateSchema.parse(rawBody);
  const subscriber = await prisma.newsletterSubscriber.upsert({
    where: { email: body.email },
    update: { status: "active", source: body.source },
    create: { email: body.email, source: body.source, status: "active" },
  });

  resolveTemplateByKey("newsletter_signup_confirmation", {
    firstName: "there",
    siteUrl: process.env.STOREFRONT_URL ?? "",
  }).then((template) =>
    sendEmail({ to: body.email, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key } })
  ).catch(() => undefined);

  return subscriber;
}

export async function importNewsletterSubscribers(rawBody: unknown) {
  const body = newsletterImportSchema.parse(rawBody);
  const created = [] as string[];

  for (const email of body.emails) {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { status: "active", source: body.source },
      create: { email, source: body.source, status: "active" },
    });
    created.push(email);
  }

  return { importedCount: created.length };
}

export async function exportNewsletterCsv() {
  const rows = await listNewsletterSubscribers();
  const header = "email,status,source,createdAt";
  const data = rows.map((row) => `${row.email},${row.status},${row.source},${row.createdAt.toISOString()}`);
  return [header, ...data].join("\n");
}


export async function sendAbandonedCartReminder(rawBody: unknown) {
  const body = abandonedCartReminderSchema.parse(rawBody);
  const config = await getAbandonedCartConfig();
  const cart = await prisma.abandonedCart.findUnique({ where: { id: body.cartId }, include: { customer: true } });
  if (!cart) throw new AppError(404, "Abandoned cart not found", "ABANDONED_CART_NOT_FOUND");
  if (cart.recoveredAt) throw new AppError(400, "Cart already recovered", "ABANDONED_CART_RECOVERED");
  if (cart.customerId) {
    const paidOrder = await prisma.order.findFirst({ where: { customerId: cart.customerId, paymentStatus: "PAID", createdAt: { gte: cart.abandonedAt } } });
    if (paidOrder) throw new AppError(400, "Customer has already completed a paid order", "ABANDONED_CART_ALREADY_CONVERTED");
  }
  const targetEmail = cart.customer?.email ?? cart.email;
  if (!targetEmail) throw new AppError(400, "Abandoned cart has no contact email", "ABANDONED_CART_NO_EMAIL");
  if (cart.customer && cart.customer.marketingEmailConsent === false) {
    throw new AppError(400, "Customer has unsubscribed from marketing email", "ABANDONED_CART_UNSUBSCRIBED");
  }

  const template = await resolveTemplateByKey(config.templateKey, {
    firstName: cart.customer?.firstName ?? "there",
    checkoutUrl: body.checkoutUrl,
  });

  await sendEmail({ to: targetEmail, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, abandonedCartId: cart.id } });
  return { sent: true, abandonedCartId: cart.id, email: targetEmail };
}
