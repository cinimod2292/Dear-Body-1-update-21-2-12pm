import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

const SITEMAP_TTL_SECONDS = 3600;

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

function sendRaw(reply: any, statusCode: number, contentType: string, cacheControl: string, body: Buffer): void {
  reply.raw.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": body.byteLength,
    "Cache-Control": cacheControl,
  });
  reply.raw.end(body);
  reply.sent = true;
}

export async function sitemapRoutes(app: FastifyInstance) {
  app.get("/robots.txt", async (_request, reply) => {
    const base = (env.STOREFRONT_URL ?? env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    const lines = ["User-agent: *", "Allow: /", ""];
    if (base) lines.push(`Sitemap: ${base}/sitemap.xml`);
    sendRaw(reply, 200, "text/plain; charset=utf-8", "public, max-age=86400", Buffer.from(lines.join("\n"), "utf-8"));
  });

  app.get("/sitemap.xml", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    const base = (env.STOREFRONT_URL ?? env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

    if (!base) {
      app.log.error("sitemap: STOREFRONT_URL or PUBLIC_BASE_URL must be set");
      reply.raw.writeHead(500, { "Content-Type": "application/json" });
      reply.raw.end(JSON.stringify({ error: { message: "Sitemap base URL not configured" } }));
      reply.sent = true;
      return;
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

    sendRaw(
      reply,
      200,
      "application/xml; charset=utf-8",
      `public, max-age=${SITEMAP_TTL_SECONDS}, stale-while-revalidate=86400`,
      Buffer.from(xml, "utf-8"),
    );
  });
}
