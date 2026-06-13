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

function urlEntry(loc: string, lastmod?: Date, priority = "0.5", changefreq?: string): string {
  const lastmodStr = lastmod ? `\n    <lastmod>${lastmod.toISOString().split("T")[0]}</lastmod>` : "";
  const changefreqStr = changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : "";
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmodStr}${changefreqStr}\n    <priority>${priority}</priority>\n  </url>`;
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

// Static builder pages that are always crawlable
const STATIC_BUILDER_PAGES = [
  { slug: "about", priority: "0.6", changefreq: "monthly" },
  { slug: "contact", priority: "0.6", changefreq: "monthly" },
  { slug: "returns", priority: "0.5", changefreq: "monthly" },
  { slug: "faq", priority: "0.5", changefreq: "weekly" },
  { slug: "delivery", priority: "0.5", changefreq: "monthly" },
  { slug: "brand", priority: "0.5", changefreq: "monthly" },
  { slug: "sale", priority: "0.7", changefreq: "daily" },
];

// Static CMS-backed pages
const STATIC_CMS_PAGES = [
  { slug: "privacy-policy", priority: "0.3", changefreq: "yearly" },
  { slug: "shipping", priority: "0.4", changefreq: "monthly" },
  { slug: "terms", priority: "0.3", changefreq: "yearly" },
];

export async function sitemapRoutes(app: FastifyInstance) {
  app.get("/robots.txt", async (_request, reply) => {
    const base = (env.STOREFRONT_URL ?? env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    const lines = [
      "User-agent: *",
      "Allow: /",
      "",
      "# Block admin portal",
      "Disallow: /admin",
      "Disallow: /admin/",
      "",
      "# Block internal API",
      "Disallow: /api/",
      "Disallow: /local-upload/",
      "",
      "# Block account/auth pages",
      "Disallow: /account/",
      "Disallow: /checkout",
      "Disallow: /cart",
      "Disallow: /builder-preview",
      "",
      "# Block utility pages",
      "Disallow: /maintenance",
      "Disallow: /coming-soon",
      "",
    ];
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

    const [products, categories, brands, cmsPages] = await Promise.all([
      prisma.product.findMany({
        where: { status: "ACTIVE", visibility: "PUBLIC" },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true, name: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.brand.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
        orderBy: { name: "asc" },
      }),
      prisma.setting.findMany({
        where: { scope: "cms", key: { not: "home_sections" } },
        select: { key: true, updatedAt: true, value: true },
      }),
    ]);

    const now = new Date();

    const entries: string[] = [
      // Homepage
      urlEntry(`${base}/`, now, "1.0", "daily"),
      // Shop / All Products
      urlEntry(`${base}/shop`, now, "0.9", "daily"),
    ];

    // Products — canonical URL is /product/:slug
    for (const p of products) {
      entries.push(urlEntry(`${base}/product/${xmlEscape(p.slug)}`, p.updatedAt, "0.8", "weekly"));
    }

    // Categories — canonical URL uses clean category slug path
    for (const c of categories) {
      entries.push(urlEntry(`${base}/shop?category=${xmlEscape(c.slug)}`, c.updatedAt, "0.7", "weekly"));
    }

    // Brands
    for (const b of brands) {
      entries.push(urlEntry(`${base}/shop?brand=${xmlEscape(b.slug)}`, b.updatedAt, "0.6", "weekly"));
    }

    // Static builder pages
    for (const page of STATIC_BUILDER_PAGES) {
      entries.push(urlEntry(`${base}/${page.slug}`, undefined, page.priority, page.changefreq));
    }

    // CMS pages (published only)
    const publishedCmsSlugs = new Set<string>();
    for (const setting of cmsPages) {
      try {
        const value = setting.value as any;
        if (value?.status === "published" && value?.slug) {
          publishedCmsSlugs.add(String(value.slug));
        }
      } catch {
        // skip malformed settings
      }
    }

    for (const page of STATIC_CMS_PAGES) {
      entries.push(urlEntry(`${base}/${page.slug}`, undefined, page.priority, page.changefreq));
    }

    // Dynamic published CMS pages not already covered by static list
    const staticSlugs = new Set([...STATIC_BUILDER_PAGES, ...STATIC_CMS_PAGES].map((p) => p.slug));
    for (const slug of publishedCmsSlugs) {
      if (!staticSlugs.has(slug)) {
        entries.push(urlEntry(`${base}/pages/${xmlEscape(slug)}`, undefined, "0.4", "monthly"));
      }
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
