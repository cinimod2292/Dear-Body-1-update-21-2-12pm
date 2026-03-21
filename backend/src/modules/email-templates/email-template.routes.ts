import { FastifyInstance } from "fastify";
import {
  createOrUpdateEmailTemplate,
  deleteEmailTemplate,
  getEmailTemplate,
  listEmailTemplates,
  patchEmailTemplate,
  previewTemplate,
  previewTemplateByKey,
  seedDefaultTemplates,
  sendTestEmailTemplate,
} from "./email-template.service.js";

export async function emailTemplateRoutes(app: FastifyInstance) {
  app.get(
    "/admin/email-templates",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      return reply.send({ data: await listEmailTemplates(request.query) });
    },
  );

  app.post(
    "/admin/email-templates/seed-defaults",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (_request, reply) => {
      return reply.send({ data: await seedDefaultTemplates() });
    },
  );

  app.get(
    "/admin/email-templates/:id",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ data: await getEmailTemplate(id) });
    },
  );

  app.put(
    "/admin/email-templates",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      return reply.send({ data: await createOrUpdateEmailTemplate(request.body) });
    },
  );

  app.patch(
    "/admin/email-templates/:id",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ data: await patchEmailTemplate(id, request.body) });
    },
  );

  app.delete(
    "/admin/email-templates/:id",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ data: await deleteEmailTemplate(id) });
    },
  );

  app.post(
    "/admin/email-templates/:id/preview",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ data: await previewTemplate(id, request.body) });
    },
  );

  app.post(
    "/admin/email-templates/by-key/:key/preview",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      return reply.send({ data: await previewTemplateByKey(key, request.body) });
    },
  );

  app.post(
    "/admin/email-templates/:id/test-send",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ data: await sendTestEmailTemplate(id, request.body) });
    },
  );
}
