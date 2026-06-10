import { FastifyInstance } from "fastify";
import {
  addCustomerInteraction,
  addCustomerNote,
  addCustomerTag,
  createCustomer,
  createCustomerAddress,
  createSupportInquiry,
  deleteAddress,
  exportCustomersCsv,
  getCustomerById,
  listCustomerAddresses,
  listCustomers,
  removeCustomerTag,
  updateAddress,
  updateCustomer,
} from "./crm.service.js";
import { sendEmail } from "../notifications/notification.service.js";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";
import { env } from "../../config/env.js";
import { z } from "zod";

const contactFormSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().max(254),
  subject: z.string().min(2).max(200),
  message: z.string().min(5).max(5000),
});

export async function crmRoutes(app: FastifyInstance) {
  // ─── Public contact form submission ──────────────────────────────────────
  app.post("/store/contact", async (request, reply) => {
    const body = contactFormSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Invalid form data", issues: body.error.issues });
    }

    const { name, email, subject, message } = body.data;
    const subjectLine = subject || "Contact form inquiry";
    const fullSubject = name ? `[Contact Form] ${subjectLine} — from ${name}` : `[Contact Form] ${subjectLine}`;

    await createSupportInquiry({ email, subject: fullSubject, message });

    const senderDisplay = name ? `${name} (${email})` : email;
    resolveTemplateByKey("contact_form_notification", {
      customerName: senderDisplay,
      message: `<strong>Subject:</strong> ${subject}<br/><br/>${message.replace(/\n/g, "<br>")}`,
    }).then((template) =>
      sendEmail({ to: env.EMAIL_FROM, subject: fullSubject, html: template.htmlBody, meta: { source: "contact_form" } })
    ).catch(() => {
      // Non-fatal: inquiry is saved even if email fails
    });

    return reply.status(201).send({ ok: true });
  });
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

  app.get("/admin/customers/:customerId/addresses", { preHandler: [app.verifyAdmin, app.requirePermission("crm:read")] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    return reply.send({ data: await listCustomerAddresses(customerId) });
  });

  app.post("/admin/customers/:customerId/addresses", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string };
    return reply.status(201).send({ data: await createCustomerAddress(customerId, request.body) });
  });

  app.patch("/admin/addresses/:addressId", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    return reply.send({ data: await updateAddress(addressId, request.body) });
  });

  app.delete("/admin/addresses/:addressId", { preHandler: [app.verifyAdmin, app.requirePermission("crm:write")] }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    await deleteAddress(addressId);
    return reply.status(204).send();
  });
}
