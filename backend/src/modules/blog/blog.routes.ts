import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { generateDraft, getPublishedArticle, listPublishedArticles, slugify, upsertArticle } from "./blog.service.js";

export async function blogRoutes(app: FastifyInstance) {
  app.get("/store/blog", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return reply.send({ data: await listPublishedArticles(request.query) });
  });
  app.get("/store/blog/:slug", async (request, reply) => {
    const data = await getPublishedArticle((request.params as any).slug);
    if (!data) return reply.status(404).send({ error: { message: "Article not found" } });
    return reply.send({ data });
  });
  app.get("/store/blog.rss", async (_request, reply) => {
    const { articles } = await listPublishedArticles({ limit: 50 });
    reply.header("Content-Type", "application/rss+xml; charset=utf-8");
    return reply.send(`<?xml version="1.0"?><rss version="2.0"><channel><title>Dear Body Blog</title>${articles.map((a:any)=>`<item><title>${a.title}</title><link>/blog/${a.slug}</link><description>${a.excerpt||""}</description></item>`).join("")}</channel></rss>`);
  });
  app.get("/admin/blog", { preHandler: [app.verifyAdmin, app.requirePermission("blog:read")] }, async (request, reply) => reply.send({ data: await listPublishedArticles({ ...(request.query as any), limit: 100, includeDrafts: true }) }));
  app.post("/admin/blog/articles", { preHandler: [app.verifyAdmin, app.requirePermission("blog:write")] }, async (request, reply) => reply.status(201).send({ data: await upsertArticle(request.body, request.user?.sub) }));
  app.put("/admin/blog/articles/:id", { preHandler: [app.verifyAdmin, app.requirePermission("blog:write")] }, async (request, reply) => reply.send({ data: await upsertArticle({ ...(request.body as any), id: (request.params as any).id }, request.user?.sub) }));
  app.post("/admin/blog/articles/:id/duplicate", { preHandler: [app.verifyAdmin, app.requirePermission("blog:write")] }, async (request, reply) => { const a:any = await prisma.blogArticle.findUnique({ where: { id: (request.params as any).id } }); return reply.status(201).send({ data: await upsertArticle({ ...a, id: undefined, title: `${a.title} Copy`, slug: `${a.slug}-copy`, status: "DRAFT" }, request.user?.sub) }); });
  app.post("/admin/blog/articles/:id/archive", { preHandler: [app.verifyAdmin, app.requirePermission("blog:write")] }, async (request, reply) => reply.send({ data: await prisma.blogArticle.update({ where: { id: (request.params as any).id }, data: { status: "ARCHIVED", archivedAt: new Date() } }) }));
  app.post("/admin/blog/generate", { preHandler: [app.verifyAdmin, app.requirePermission("blog:write")] }, async (request, reply) => reply.send({ data: await generateDraft(request.body) }));
  app.get("/admin/blog/meta", { preHandler: [app.verifyAdmin, app.requirePermission("blog:read")] }, async (_request, reply) => reply.send({ data: { categories: await prisma.blogCategory.findMany(), tags: await prisma.blogTag.findMany(), authors: await prisma.blogAuthor.findMany(), products: await prisma.product.findMany({ take: 100, where: { status: "ACTIVE" }, include: { variants: { take: 1 }, galleries: { take: 1, include: { mediaAsset: true } } } }) } }));
  app.post("/admin/blog/categories", { preHandler: [app.verifyAdmin, app.requirePermission("blog:write")] }, async (request, reply) => { const b:any=request.body; return reply.status(201).send({ data: await prisma.blogCategory.create({ data: { ...b, slug: slugify(b.slug || b.name) } }) }); });
  app.post("/admin/blog/authors", { preHandler: [app.verifyAdmin, app.requirePermission("blog:write")] }, async (request, reply) => { const b:any=request.body; return reply.status(201).send({ data: await prisma.blogAuthor.create({ data: { ...b, slug: slugify(b.slug || b.name) } }) }); });
}
