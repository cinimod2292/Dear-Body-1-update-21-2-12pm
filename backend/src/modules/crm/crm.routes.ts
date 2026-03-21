import { FastifyInstance } from "fastify";
import {
  addCustomerInteraction,
  addCustomerNote,
  addCustomerTag,
  createCustomer,
  createSupportInquiry,
  exportCustomersCsv,
  getCustomerById,
  listCustomers,
  removeCustomerTag,
  updateCustomer,
} from "./crm.service.js";

export async function crmRoutes(app: FastifyInstance) {
  app.get("/admin/customers", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (request, reply) => {
    const data = await listCustomers(request.query);
    return reply.send({ data });
  });

  app.get("/admin/customers/export.csv", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (request, reply) => {
    const csv = await exportCustomersCsv(request.query);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", "attachment; filename=customers.csv");
    return reply.send(csv);
  });

  app.post("/admin/customers", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const data = await createCustomer(request.body);
    return reply.status(201).send({ data });
  });

  app.get("/admin/customers/:customerId", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const data = await getCustomerById(customerId);
    return reply.send({ data });
  });

  app.patch("/admin/customers/:customerId", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const data = await updateCustomer(customerId, request.body);
    return reply.send({ data });
  });

  app.post("/admin/customers/:customerId/notes", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const data = await addCustomerNote(customerId, request.body, request.user.sub);
    return reply.status(201).send({ data });
  });

  app.post("/admin/customers/:customerId/interactions", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const data = await addCustomerInteraction(customerId, request.body, request.user.sub);
    return reply.status(201).send({ data });
  });

  app.post("/admin/customers/:customerId/tags", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    const data = await addCustomerTag(customerId, request.body);
    return reply.status(201).send({ data });
  });

  app.delete("/admin/customers/:customerId/tags/:tagId", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { customerId, tagId } = request.params as { customerId: string; tagId: string };
    await removeCustomerTag(customerId, tagId);
    return reply.status(204).send();
  });

  app.post("/admin/support/inquiries", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const data = await createSupportInquiry(request.body);
    return reply.status(201).send({ data });
  });
}
