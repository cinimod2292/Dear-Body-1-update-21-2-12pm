import { FastifyInstance } from "fastify";
import {
  bulkCouponAction,
  createNewsletterSubscriber,
  createAdminShippingMethod,
  deactivateAdminShippingMethod,
  exportNewsletterCsv,
  getCustomerReport,
  getDashboardKpis,
  getInventoryReport,
  getOrderReport,
  getRecentActivity,
  getSalesReport,
  getShippingRules,
  importNewsletterSubscribers,
  listCoupons,
  listInquiries,
  listAdminShippingMethods,
  listNewsletterSubscribers,
  listShippingMethods,
  listTaxRates,
  getAbandonedCartConfig,
  upsertAbandonedCartConfig,
  processAbandonedCarts,
  sendAbandonedCartReminder,
  updateInquiry,
  updateAdminShippingMethod,
  upsertCoupon,
  upsertShippingRules,
  upsertShippingMethod,
  upsertTaxRate,
} from "./ops.service.js";

export async function opsRoutes(app: FastifyInstance) {
  app.post("/store/newsletter/subscribe", async (request, reply) => reply.status(201).send({ data: await createNewsletterSubscriber(request.body) }));
  app.get("/admin/reports/dashboard", { preHandler: [app.verifyAdmin, app.requirePermission("dashboard:read")] }, async (request, reply) => reply.send({ data: await getDashboardKpis(request.query) }));
  app.get("/admin/reports/sales", { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] }, async (request, reply) => reply.send({ data: await getSalesReport(request.query) }));
  app.get("/admin/reports/orders", { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] }, async (request, reply) => reply.send({ data: await getOrderReport(request.query) }));
  app.get("/admin/reports/customers", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (request, reply) => reply.send({ data: await getCustomerReport(request.query) }));
  app.get("/admin/reports/inventory", { preHandler: [app.verifyAdmin, app.requirePermission("inventory:read")] }, async (_request, reply) => reply.send({ data: await getInventoryReport() }));
  app.get("/admin/reports/recent-activity", { preHandler: [app.verifyAdmin, app.requirePermission("dashboard:read")] }, async (_request, reply) => reply.send({ data: await getRecentActivity() }));

  app.get("/admin/ops/coupons", { preHandler: [app.verifyAdmin, app.requirePermission("orders:read")] }, async (_request, reply) => reply.send({ data: await listCoupons() }));
  app.put("/admin/ops/coupons", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => reply.send({ data: await upsertCoupon(request.body) }));
  app.post("/admin/ops/coupons/bulk", { preHandler: [app.verifyAdmin, app.requirePermission("orders:write")] }, async (request, reply) => reply.send({ data: await bulkCouponAction(request.body) }));

  app.get("/admin/ops/shipping-methods", { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] }, async (_request, reply) => reply.send({ data: await listShippingMethods() }));
  app.put("/admin/ops/shipping-methods", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => reply.send({ data: await upsertShippingMethod(request.body) }));
  app.get("/admin/shipping-methods", { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] }, async (_request, reply) => reply.send({ data: await listAdminShippingMethods() }));
  app.post("/admin/shipping-methods", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => reply.status(201).send({ data: await createAdminShippingMethod(request.body) }));
  app.put("/admin/shipping-methods/:id", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send({ data: await updateAdminShippingMethod(id, request.body) });
  });
  app.delete("/admin/shipping-methods/:id", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send({ data: await deactivateAdminShippingMethod(id) });
  });
  app.get("/admin/shipping-settings", { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] }, async (_request, reply) => reply.send({ data: await getShippingRules() }));
  app.put("/admin/shipping-settings", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => reply.send({ data: await upsertShippingRules(request.body) }));

  app.get("/admin/ops/tax-rates", { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] }, async (_request, reply) => reply.send({ data: await listTaxRates() }));
  app.post("/admin/ops/tax-rates", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => reply.send({ data: await upsertTaxRate(request.body) }));

  app.get("/admin/ops/inquiries", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (_request, reply) => reply.send({ data: await listInquiries() }));
  app.patch("/admin/ops/inquiries/:id", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send({ data: await updateInquiry(id, request.body) });
  });

  app.get("/admin/ops/newsletter", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (_request, reply) => reply.send({ data: await listNewsletterSubscribers() }));
  app.post("/admin/ops/newsletter", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => reply.status(201).send({ data: await createNewsletterSubscriber(request.body) }));
  app.post("/admin/ops/newsletter/import", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => reply.send({ data: await importNewsletterSubscribers(request.body) }));
  app.post("/admin/ops/abandoned-carts/remind", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => reply.send({ data: await sendAbandonedCartReminder(request.body) }));
  app.get("/admin/ops/abandoned-carts/config", { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] }, async (_request, reply) => reply.send({ data: await getAbandonedCartConfig() }));
  app.put("/admin/ops/abandoned-carts/config", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => reply.send({ data: await upsertAbandonedCartConfig(request.body) }));
  app.post("/admin/ops/abandoned-carts/process", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (_request, reply) => reply.send({ data: await processAbandonedCarts() }));

  app.get("/admin/ops/newsletter/export.csv", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (_request, reply) => {
    const csv = await exportNewsletterCsv();
    reply.header("Content-Type", "text/csv");
    return reply.send(csv);
  });
}
