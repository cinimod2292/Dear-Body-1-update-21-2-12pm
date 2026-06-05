import { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../../config/env.js";
import {
  getCmsBootstrap,
  getHomeSections,
  getSiteConfig,
  getStaticPageBySlug,
  listStaticPages,
  reorderHomeSections,
  updateSiteStatus,
  upsertHomeSections,
  upsertSiteConfig,
  upsertStaticPage,
} from "./cms.service.js";

export async function cmsRoutes(app: FastifyInstance) {
  app.get("/store/cms/bootstrap", async (_request, reply) => {
    const bootstrap = await getCmsBootstrap();
    if (env.MAINTENANCE_MODE) {
      bootstrap.siteConfig.siteStatus = { maintenanceMode: true, comingSoon: false };
    }
    reply.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600, stale-if-error=86400");
    reply.header("Vary", "Accept-Encoding");
    return reply.send({ data: bootstrap });
  });

  app.patch(
    "/admin/cms/site-status",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const body = z.object({
        maintenanceMode: z.boolean(),
        comingSoon: z.boolean(),
      }).parse(request.body);
      return reply.send({ data: await updateSiteStatus(body.maintenanceMode, body.comingSoon) });
    },
  );

  app.get("/store/cms/pages/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    return reply.send({ data: await getStaticPageBySlug(slug, false) });
  });

  app.get(
    "/admin/cms/site-config",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await getSiteConfig() }),
  );

  app.put(
    "/admin/cms/site-config",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => reply.send({ data: await upsertSiteConfig(request.body) }),
  );

  app.get(
    "/admin/cms/home-sections",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await getHomeSections() }),
  );

  app.put(
    "/admin/cms/home-sections",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => reply.send({ data: await upsertHomeSections(request.body) }),
  );

  app.post(
    "/admin/cms/home-sections/reorder",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => reply.send({ data: await reorderHomeSections(request.body) }),
  );

  app.get(
    "/admin/cms/pages",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await listStaticPages() }),
  );

  app.get(
    "/admin/cms/pages/:slug",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      return reply.send({ data: await getStaticPageBySlug(slug, true) });
    },
  );

  app.put(
    "/admin/cms/pages/:slug",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      return reply.send({ data: await upsertStaticPage({ ...(request.body as object), slug }) });
    },
  );
}
