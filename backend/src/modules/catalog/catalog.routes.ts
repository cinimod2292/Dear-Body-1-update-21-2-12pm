import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  attachImagesToProduct,
  bulkProductAction,
  commitProductImageImport,
  commitProductImport,
  createProduct,
  createVariant,
  getProductById,
  getStorefrontProductById,
  getProductImportTemplateCsv,
  listProducts,
  listProductsMissingImages,
  listStorefrontProducts,
  migrateLegacyProductImages,
  previewProductImportCsv,
  previewProductImageImportCsv,
  updateProduct,
  updateVariant,
} from "./catalog.service.js";

const CSV_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const CSV_MAX_ROWS = 10_000;

async function readCsvFromRequest(request: any): Promise<string | null> {
  const part = await request.file();
  if (!part) return null;
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of part.file) {
    const buf = Buffer.from(chunk);
    totalBytes += buf.byteLength;
    if (totalBytes > CSV_MAX_BYTES) {
      throw { statusCode: 413, message: `CSV file exceeds the ${CSV_MAX_BYTES / 1024 / 1024} MB limit.` };
    }
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  const rowCount = text.split("\n").length - 1; // subtract header
  if (rowCount > CSV_MAX_ROWS) {
    throw { statusCode: 413, message: `CSV has ${rowCount} rows, which exceeds the ${CSV_MAX_ROWS.toLocaleString()} row limit.` };
  }
  return text;
}

export async function catalogRoutes(app: FastifyInstance) {
  const storefrontCacheHeader = "public, max-age=60, s-maxage=300, stale-while-revalidate=600, stale-if-error=86400";

  app.get("/store/products", async (request, reply) => {
    const result = await listStorefrontProducts(request.query);
    reply.header("Cache-Control", storefrontCacheHeader);
    reply.header("Vary", "Accept-Encoding");
    return reply.send({ data: result });
  });

  app.get("/store/products/:productId", async (request, reply) => {
    const { productId } = request.params as { productId: string };
    const product = await getStorefrontProductById(productId);
    reply.header("Cache-Control", storefrontCacheHeader);
    reply.header("Vary", "Accept-Encoding");
    return reply.send({ data: product });
  });

  app.get("/admin/products", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (request, reply) => {
    const result = await listProducts(request.query);
    return reply.send({ data: result });
  });

  app.get("/admin/products/missing-images", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (_request, reply) => {
    const result = await listProductsMissingImages();
    return reply.send({ data: result });
  });

  app.post("/admin/products", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const product = await createProduct(request.body);
    return reply.status(201).send({ data: product });
  });

  app.get("/admin/products/import/template.csv", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (_request, reply) => {
    const query = _request.query as { simple?: string };
    const csv = getProductImportTemplateCsv({ simple: query.simple === "1" || query.simple === "true" });
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", "attachment; filename=product-import-template.csv");
    return reply.send(csv);
  });

  app.post("/admin/products/import/preview", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const csvContent = await readCsvFromRequest(request);
    if (!csvContent) {
      return reply.status(400).send({ error: { message: "CSV file is required" } });
    }

    const result = await previewProductImportCsv(csvContent);
    return reply.send({ data: result });
  });

  app.post("/admin/products/import/commit", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const contentType = request.headers["content-type"] ?? "";

    if (typeof contentType === "string" && contentType.includes("multipart/form-data")) {
      const csvContent = await readCsvFromRequest(request);
      if (!csvContent) {
        return reply.status(400).send({ error: { message: "CSV file is required" } });
      }
      const result = await commitProductImport({ csvContent });
      return reply.send({ data: result });
    }

    const body = request.body as { rows?: Array<Record<string, unknown>> };
    const result = await commitProductImport({ rows: body?.rows });
    return reply.send({ data: result });
  });

  app.post("/admin/products/images/import/preview", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const csvContent = await readCsvFromRequest(request);
    if (!csvContent) {
      return reply.status(400).send({ error: { message: "CSV file is required" } });
    }

    const result = await previewProductImageImportCsv(csvContent);
    return reply.send({ data: result });
  });

  app.post("/admin/products/images/import/commit", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const csvContent = await readCsvFromRequest(request);
    if (!csvContent) {
      return reply.status(400).send({ error: { message: "CSV file is required" } });
    }
    const result = await commitProductImageImport(csvContent, request.user.sub);
    return reply.send({ data: result });
  });

  app.post("/admin/products/images/legacy-migration", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const result = await migrateLegacyProductImages(request.body);
    return reply.send({ data: result });
  });

  app.get("/admin/products/:productId", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (request, reply) => {
    const params = request.params as { productId: string };
    const product = await getProductById(params.productId);
    return reply.send({ data: product });
  });

  app.patch("/admin/products/:productId", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const params = request.params as { productId: string };
    const product = await updateProduct(params.productId, request.body);
    return reply.send({ data: product });
  });

  app.post("/admin/products/:productId/images/attach", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const result = await attachImagesToProduct(request.params, request.body);
    return reply.send({ data: result });
  });

  app.post("/admin/products/bulk", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const result = await bulkProductAction(request.body);
    return reply.send({ data: result });
  });

  app.post("/admin/products/:productId/variants", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const params = request.params as { productId: string };
    const variant = await createVariant(params.productId, request.body);
    return reply.status(201).send({ data: variant });
  });

  app.patch("/admin/variants/:variantId", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const params = request.params as { variantId: string };
    const variant = await updateVariant(params.variantId, request.body);
    return reply.send({ data: variant });
  });

  // Auto-generate missing SEO metadata for products using rule-based templates
  app.post("/admin/products/generate-seo", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (_request, reply) => {
    const products = await prisma.product.findMany({
      where: { seoMetadataId: null, status: "ACTIVE" },
      include: { category: { select: { name: true } }, brand: { select: { name: true } } },
    });

    let created = 0;
    for (const p of products) {
      const categoryName = p.category?.name ?? "beauty";
      const brandName = p.brand?.name ?? "Dear Body";
      const title = `${p.name} | ${brandName} South Africa`;
      const description = `Shop ${p.name} by ${brandName}. Premium ${categoryName.toLowerCase()} delivered across South Africa. Fast shipping, secure checkout.`;
      const seoMeta = await prisma.seoMetadata.create({ data: { title, description } });
      await prisma.product.update({ where: { id: p.id }, data: { seoMetadataId: seoMeta.id } });
      created++;
    }

    return reply.send({ data: { created, total: products.length } });
  });
}
