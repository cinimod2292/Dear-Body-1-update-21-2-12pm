import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

const SITEMAP_TTL_SECONDS = 3600; // regenerate at most once per hour via Cache-Control

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod?: Date, priority = "0.5"): string {
  const lastmodStr = lastmod ? `\n    <lastmod>${lastmod.toISOString().split("T")[0]}</lastmod>` : "";
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmodStr}\n    <priority>${priority}</priority>\n  </url>`;
}

export async function sitemapRoutes(app: FastifyInstance) {
  app.get("/robots.txt", async (_request, reply) => {
    const base = (env.STOREFRONT_URL ?? env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    const sitemapLine = base ? `Sitemap: ${base}/sitemap.xml` : "";
    const body = [
      "User-agent: *",
      "Allow: /",
      "",
      sitemapLine,
    ].filter((line, i) => i < 3 || line).join("\n");

    reply
      .header("Content-Type", "text/plain; charset=utf-8")
      .header("Cache-Control", "public, max-age=86400")
      .status(200)
      .send(body);
  });

  app.get("/sitemap.xml", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const base = (env.STOREFRONT_URL ?? env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

    if (!base) {
      app.log.error("sitemap: STOREFRONT_URL or PUBLIC_BASE_URL must be set");
      return reply.status(500).send({ error: { message: "Sitemap base URL not configured" } });
    }

    const [products, categories, brands] = await Promise.all([
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.brand.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const entries: string[] = [
      urlEntry(`${base}/`, undefined, "1.0"),
      urlEntry(`${base}/shop`, undefined, "0.9"),
    ];

    for (const p of products) {
      entries.push(urlEntry(`${base}/products/${xmlEscape(p.slug)}`, p.updatedAt, "0.8"));
    }
    for (const c of categories) {
      entries.push(urlEntry(`${base}/shop?category=${xmlEscape(c.slug)}`, c.updatedAt, "0.7"));
    }
    for (const b of brands) {
      entries.push(urlEntry(`${base}/shop?brand=${xmlEscape(b.slug)}`, b.updatedAt, "0.6"));
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries,
      "</urlset>",
    ].join("\n");

    reply
      .header("Content-Type", "application/xml; charset=utf-8")
      .header("Cache-Control", `public, max-age=${SITEMAP_TTL_SECONDS}, stale-while-revalidate=86400`)
      .header("X-Robots-Tag", "noindex")
      .status(200)
      .send(xml);
  });
}
