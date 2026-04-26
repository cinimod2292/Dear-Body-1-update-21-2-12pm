import { FastifyInstance } from "fastify";
import {
  discardBuilderDraft,
  getAdminBuilderPage,
  getStoreBuilderPage,
  listBuilderPages,
  publishBuilderDraft,
  updateBuilderDraft,
} from "./builder.service.js";

export async function builderRoutes(app: FastifyInstance) {
  app.get(
    "/admin/builder/pages",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await listBuilderPages() }),
  );

  app.get(
    "/admin/builder/pages/:pageKey",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      return reply.send({ data: await getAdminBuilderPage(pageKey) });
    },
  );

  app.put(
    "/admin/builder/pages/:pageKey/draft",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      const actorUserId = (request.user as { sub?: string } | undefined)?.sub ?? null;
      return reply.send({ data: await updateBuilderDraft(pageKey, request.body, actorUserId) });
    },
  );

  app.post(
    "/admin/builder/pages/:pageKey/publish",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      const actorUserId = (request.user as { sub?: string } | undefined)?.sub ?? null;
      return reply.send({ data: await publishBuilderDraft(pageKey, actorUserId) });
    },
  );

  app.post(
    "/admin/builder/pages/:pageKey/discard-draft",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      const actorUserId = (request.user as { sub?: string } | undefined)?.sub ?? null;
      return reply.send({ data: await discardBuilderDraft(pageKey, actorUserId) });
    },
  );

  app.get("/store/builder/pages/:pageKey", async (request, reply) => {
    const { pageKey } = request.params as { pageKey: string };
    const page = await getStoreBuilderPage(pageKey);
    if (!page) return reply.send({ data: null });
    reply.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600, stale-if-error=86400");
    return reply.send({ data: page });
  });
}
