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
} from "./ops.schemas.js";

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
  return prisma.newsletterSubscriber.upsert({
    where: { email: body.email },
    update: { status: "active", source: body.source },
    create: { email: body.email, source: body.source, status: "active" },
  });
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
  const cart = await prisma.abandonedCart.findUnique({ where: { id: body.cartId }, include: { customer: true } });
  if (!cart) throw new AppError(404, "Abandoned cart not found", "ABANDONED_CART_NOT_FOUND");
  const targetEmail = cart.customer?.email ?? cart.email;
  if (!targetEmail) throw new AppError(400, "Abandoned cart has no contact email", "ABANDONED_CART_NO_EMAIL");

  const template = await resolveTemplateByKey("abandoned_cart_reminder", {
    firstName: cart.customer?.firstName ?? "there",
    checkoutUrl: body.checkoutUrl,
  });

  await sendEmail({ to: targetEmail, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, abandonedCartId: cart.id } });
  return { sent: true, abandonedCartId: cart.id, email: targetEmail };
}
