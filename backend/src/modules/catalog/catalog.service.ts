import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import {
  bulkProductActionSchema,
  createProductSchema,
  createVariantSchema,
  importCommitPayloadSchema,
  importProductRowSchema,
  productFilterSchema,
  updateProductSchema,
  updateVariantSchema,
} from "./catalog.schemas.js";
import { toPaginatedResponse } from "../../lib/pagination.js";

const IMPORT_TEMPLATE_HEADERS = [
  "sku",
  "product_name",
  "price",
  "brand_name",
  "category_name",
  "quantity_on_hand",
  "description",
  "short_description",
  "status",
  "visibility",
  "featured",
  "sale_price",
  "cost_price",
  "barcode",
];

const SIMPLE_IMPORT_TEMPLATE_HEADERS = [
  "sku",
  "product_name",
  "price",
  "brand_name",
  "category_name",
  "quantity_on_hand",
];

const DEFAULT_TEMPLATE_ROW = {
  sku: "DB-SERUM-001",
  product_name: "Vitamin C Serum",
  price: "29.99",
  brand_name: "Dear Body",
  category_name: "Serums",
  quantity_on_hand: "100",
  description: "Brightening daily serum for all skin types.",
  short_description: "Brightening daily serum",
  status: "ACTIVE",
  visibility: "PUBLIC",
  featured: "false",
  sale_price: "24.99",
  cost_price: "12.50",
  barcode: "6001234567890",
} as const;

const SIMPLE_TEMPLATE_ROW = {
  sku: "DB-SERUM-001",
  product_name: "Vitamin C Serum",
  price: "29.99",
  brand_name: "Dear Body",
  category_name: "Serums",
  quantity_on_hand: "100",
} as const;

type ImportOperation = "create" | "update" | "error";

type ParsedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: Record<string, unknown>;
  sku: string;
  productName: string;
  operation: ImportOperation;
  errors: string[];
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });

    rows.push(row);
  }

  return rows;
}

function toOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "item";
}

async function generateUniqueSlug(base: string, table: "product" | "brand" | "category", tx: any = prisma) {
  const normalized = slugify(base);
  let candidate = normalized;
  let counter = 2;

  while (true) {
    let existing: { id: string } | null = null;
    if (table === "product") existing = await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (table === "brand") existing = await tx.brand.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (table === "category") existing = await tx.category.findUnique({ where: { slug: candidate }, select: { id: true } });

    if (!existing) return candidate;
    candidate = `${normalized}-${counter}`;
    counter += 1;
  }
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

async function findOrCreateBrand(brandName: string | undefined, tx: any) {
  if (!brandName) return undefined;
  const normalized = normalizeName(brandName);
  if (!normalized) return undefined;

  const existing = await tx.brand.findMany({ select: { id: true, name: true }, take: 2000 });
  const matched = existing.find((brand: { id: string; name: string }) => normalizeName(brand.name) === normalized);
  if (matched) return matched.id;

  const slug = await generateUniqueSlug(brandName, "brand", tx);
  const created = await tx.brand.create({ data: { name: brandName.trim(), slug, isActive: true } });
  return created.id;
}

async function findOrCreateCategory(categoryName: string | undefined, tx: any) {
  if (!categoryName) return undefined;
  const normalized = normalizeName(categoryName);
  if (!normalized) return undefined;

  const existing = await tx.category.findMany({ select: { id: true, name: true }, take: 2000 });
  const matched = existing.find((category: { id: string; name: string }) => normalizeName(category.name) === normalized);
  if (matched) return matched.id;

  const slug = await generateUniqueSlug(categoryName, "category", tx);
  const created = await tx.category.create({ data: { name: categoryName.trim(), slug, isActive: true } });
  return created.id;
}

async function normalizeRow(rawRow: Record<string, string>) {
  const lowered: Record<string, string> = {};
  Object.entries(rawRow).forEach(([key, value]) => {
    lowered[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : "";
  });

  const parsed = importProductRowSchema.safeParse(lowered);
  if (!parsed.success) {
    return { data: lowered as Record<string, unknown>, errors: parsed.error.issues.map((issue) => issue.message) };
  }

  return { data: parsed.data as Record<string, unknown>, errors: [] as string[] };
}

function validateRow(row: Record<string, unknown>, rowNumber: number, duplicateSkuRows: Set<number>) {
  const errors: string[] = [];
  const sku = toOptionalString(row.sku) ?? "";
  const productName = toOptionalString(row.product_name) ?? "";
  const price = Number(row.price);
  const salePrice = row.sale_price !== undefined && row.sale_price !== "" ? Number(row.sale_price) : undefined;
  const costPrice = row.cost_price !== undefined && row.cost_price !== "" ? Number(row.cost_price) : undefined;
  const quantityOnHand = row.quantity_on_hand !== undefined && row.quantity_on_hand !== "" ? Number(row.quantity_on_hand) : undefined;

  if (!sku) errors.push("SKU is required");
  if (!productName) errors.push("Product name is required");
  if (!Number.isFinite(price) || price < 0) errors.push("Price must be a number greater than or equal to 0");

  if (salePrice !== undefined && (!Number.isFinite(salePrice) || salePrice < 0)) {
    errors.push("Sale price must be a number greater than or equal to 0");
  }

  if (costPrice !== undefined && (!Number.isFinite(costPrice) || costPrice < 0)) {
    errors.push("Cost price must be a number greater than or equal to 0");
  }

  if (quantityOnHand !== undefined && !Number.isInteger(quantityOnHand)) {
    errors.push("Quantity on hand must be an integer");
  }

  if (duplicateSkuRows.has(rowNumber)) {
    errors.push("Duplicate SKU in file");
  }

  if (row.status && !["DRAFT", "ACTIVE", "ARCHIVED"].includes(String(row.status))) {
    errors.push("Status must be DRAFT, ACTIVE, or ARCHIVED");
  }

  if (row.visibility && !["PUBLIC", "HIDDEN", "PRIVATE"].includes(String(row.visibility))) {
    errors.push("Visibility must be PUBLIC, HIDDEN, or PRIVATE");
  }
  if (row.featured !== undefined && parseBoolean(row.featured) === undefined) {
    errors.push("Featured must be true or false");
  }

  return { sku, productName, errors };
}

async function buildImportPreview(rawRows: Array<Record<string, string>>) {
  const skuFrequency = new Map<string, number>();
  rawRows.forEach((rawRow) => {
    const sku = (rawRow.sku ?? "").trim().toLowerCase();
    if (!sku) return;
    skuFrequency.set(sku, (skuFrequency.get(sku) ?? 0) + 1);
  });

  const duplicateSkuRows = new Set<number>();
  rawRows.forEach((rawRow, idx) => {
    const sku = (rawRow.sku ?? "").trim().toLowerCase();
    if (!sku) return;
    if ((skuFrequency.get(sku) ?? 0) > 1) duplicateSkuRows.add(idx + 2);
  });

  const rows: ParsedImportRow[] = [];

  for (let index = 0; index < rawRows.length; index += 1) {
    const rowNumber = index + 2;
    const raw = rawRows[index];
    const normalizedResult = await normalizeRow(raw);
    const validation = validateRow(normalizedResult.data, rowNumber, duplicateSkuRows);
    const errors = [...normalizedResult.errors, ...validation.errors];

    let operation: ImportOperation = "error";
    if (!errors.length && validation.sku) {
      const existingVariant = await prisma.productVariant.findUnique({ where: { sku: validation.sku }, select: { id: true } });
      operation = existingVariant ? "update" : "create";
    }

    rows.push({
      rowNumber,
      raw,
      normalized: normalizedResult.data,
      sku: validation.sku,
      productName: validation.productName,
      operation: errors.length ? "error" : operation,
      errors,
    });
  }

  return {
    rows: rows.map((row) => ({
      rowNumber: row.rowNumber,
      sku: row.sku,
      product_name: row.productName,
      operation: row.operation,
      errors: row.errors,
      rowData: row.raw,
    })),
    summary: {
      total: rows.length,
      creates: rows.filter((row) => row.operation === "create").length,
      updates: rows.filter((row) => row.operation === "update").length,
      errors: rows.filter((row) => row.operation === "error").length,
    },
    internalRows: rows,
  };
}

async function upsertProductBySku(row: ParsedImportRow) {
  const payload = row.normalized;
  const sku = String(payload.sku);
  const name = String(payload.product_name);
  const productSlug = toOptionalString(payload.product_slug) ?? slugify(name);

  return prisma.$transaction(async (tx) => {
    const brandId = await findOrCreateBrand(toOptionalString(payload.brand_name), tx);
    const categoryId = await findOrCreateCategory(toOptionalString(payload.category_name), tx);

    const existingVariant = await tx.productVariant.findUnique({ where: { sku }, include: { product: true, inventoryLevel: true } });
    const finalSlug = existingVariant
      ? existingVariant.product.slug
      : await generateUniqueSlug(productSlug, "product", tx);

    const productData = {
      name,
      slug: finalSlug,
      shortDescription: toOptionalString(payload.short_description),
      description: toOptionalString(payload.description),
      status: payload.status ? String(payload.status) as "DRAFT" | "ACTIVE" | "ARCHIVED" : "DRAFT",
      visibility: payload.visibility ? String(payload.visibility) as "PUBLIC" | "HIDDEN" | "PRIVATE" : "PUBLIC",
      featured: parseBoolean(payload.featured) ?? false,
      brandId,
      categoryId,
      publishedAt: payload.status === "ACTIVE" ? new Date() : null,
    };

    const variantData = {
      title: undefined as string | undefined,
      sku,
      barcode: toOptionalString(payload.barcode),
      price: Number(payload.price),
      salePrice: payload.sale_price !== undefined && payload.sale_price !== "" ? Number(payload.sale_price) : null,
      costPrice: payload.cost_price !== undefined && payload.cost_price !== "" ? Number(payload.cost_price) : null,
      lowStockThreshold: payload.low_stock_threshold !== undefined && payload.low_stock_threshold !== "" ? Number(payload.low_stock_threshold) : 5,
      quantityOnHand: payload.quantity_on_hand !== undefined && payload.quantity_on_hand !== "" ? Number(payload.quantity_on_hand) : 0,
    };

    if (existingVariant) {
      const updatedProduct = await tx.product.update({
        where: { id: existingVariant.productId },
        data: {
          name: productData.name,
          shortDescription: productData.shortDescription,
          description: productData.description,
          status: productData.status,
          visibility: productData.visibility,
          featured: productData.featured,
          brandId: productData.brandId,
          categoryId: productData.categoryId,
          publishedAt: productData.status === "ACTIVE" ? (existingVariant.product.publishedAt ?? new Date()) : null,
        },
      });

      await tx.productVariant.update({
        where: { id: existingVariant.id },
        data: {
          barcode: variantData.barcode,
          price: variantData.price,
          salePrice: variantData.salePrice,
          costPrice: variantData.costPrice,
        },
      });

      await tx.inventoryLevel.upsert({
        where: { variantId: existingVariant.id },
        create: {
          variantId: existingVariant.id,
          quantityOnHand: variantData.quantityOnHand,
          lowStockThreshold: variantData.lowStockThreshold,
        },
        update: {
          quantityOnHand: variantData.quantityOnHand,
          lowStockThreshold: variantData.lowStockThreshold,
        },
      });

      return { operation: "updated" as const, productId: updatedProduct.id };
    }

    const createdProduct = await tx.product.create({
      data: {
        name: productData.name,
        slug: productData.slug,
        shortDescription: productData.shortDescription,
        description: productData.description,
        status: productData.status,
        visibility: productData.visibility,
        featured: productData.featured,
        brandId: productData.brandId,
        categoryId: productData.categoryId,
        publishedAt: productData.status === "ACTIVE" ? new Date() : null,
      },
    });

    await tx.productVariant.create({
      data: {
        productId: createdProduct.id,
        title: variantData.title,
        sku: variantData.sku,
        barcode: variantData.barcode,
        price: variantData.price,
        salePrice: variantData.salePrice,
        costPrice: variantData.costPrice,
        inventoryLevel: {
          create: {
            quantityOnHand: variantData.quantityOnHand,
            lowStockThreshold: variantData.lowStockThreshold,
          },
        },
        stockMovements: {
          create: {
            movementType: "INITIAL_STOCK",
            quantityDelta: variantData.quantityOnHand,
            quantityBefore: 0,
            quantityAfter: variantData.quantityOnHand,
            reason: "Initial stock set on bulk import",
          },
        },
      },
    });

    return { operation: "created" as const, productId: createdProduct.id };
  });
}

export function getProductImportTemplateCsv(options?: { simple?: boolean }) {
  const headers = options?.simple ? SIMPLE_IMPORT_TEMPLATE_HEADERS : IMPORT_TEMPLATE_HEADERS;
  const sampleRow = options?.simple ? SIMPLE_TEMPLATE_ROW : DEFAULT_TEMPLATE_ROW;
  const rows = [
    headers.map(csvEscape).join(","),
    headers.map((header) => csvEscape(sampleRow[header as keyof typeof sampleRow] ?? "")).join(","),
  ];

  return rows.join("\n");
}

export async function previewProductImportCsv(csvContent: string) {
  const rawRows = parseCsv(csvContent);
  const preview = await buildImportPreview(rawRows);
  return {
    rows: preview.rows,
    summary: preview.summary,
  };
}

export async function commitProductImport(input: { csvContent?: string; rows?: Array<Record<string, unknown>> }) {
  let rawRows: Array<Record<string, string>> = [];

  if (input.csvContent !== undefined) {
    rawRows = parseCsv(input.csvContent);
  } else if (input.rows) {
    const body = importCommitPayloadSchema.parse({ rows: input.rows });
    rawRows = body.rows.map((row) => {
      const normalized: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        normalized[key] = value === undefined || value === null ? "" : String(value).trim();
      });
      return normalized;
    });
  }

  const preview = await buildImportPreview(rawRows);
  const results: Array<{ rowNumber: number; status: "created" | "updated" | "failed"; error?: string; rowData?: Record<string, string> }> = [];
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const row of preview.internalRows) {
    if (row.errors.length || row.operation === "error") {
      failed += 1;
      results.push({
        rowNumber: row.rowNumber,
        status: "failed",
        error: row.errors.join("; ") || "Validation failed",
        rowData: row.raw,
      });
      continue;
    }

    try {
      const upsert = await upsertProductBySku(row);
      if (upsert.operation === "created") {
        created += 1;
        results.push({ rowNumber: row.rowNumber, status: "created" });
      } else {
        updated += 1;
        results.push({ rowNumber: row.rowNumber, status: "updated" });
      }
    } catch (error) {
      failed += 1;
      results.push({
        rowNumber: row.rowNumber,
        status: "failed",
        error: error instanceof Error ? error.message : "Unexpected error while importing row",
        rowData: row.raw,
      });
    }
  }

  return {
    summary: {
      created,
      updated,
      failed,
    },
    results,
  };
}

export async function listProducts(rawQuery: unknown) {
  const query = productFilterSchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;
  const take = query.perPage;

  const where = {
    ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { slug: { contains: query.q, mode: "insensitive" as const } }] } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.featured !== undefined ? { featured: query.featured } : {}),
    ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy]: query.sortDir },
      include: {
        brand: true,
        category: true,
        seoMetadata: true,
        tags: { include: { tag: true } },
        galleries: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
        variants: { include: { inventoryLevel: true, attributeValues: { include: { attribute: true, option: true } } } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return toPaginatedResponse(items, total, query);
}

export async function getProductById(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      category: true,
      seoMetadata: true,
      tags: { include: { tag: true } },
      galleries: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
      variants: { include: { inventoryLevel: true, attributeValues: { include: { attribute: true, option: true } } } },
    },
  });

  if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
  return product;
}

export async function createProduct(rawBody: unknown) {
  const body = createProductSchema.parse(rawBody);

  const created = await prisma.product.create({
    data: {
      name: body.name,
      slug: body.slug,
      description: body.description,
      shortDescription: body.shortDescription,
      status: body.status,
      visibility: body.visibility,
      featured: body.featured,
      brandId: body.brandId,
      categoryId: body.categoryId,
      defaultCurrency: body.defaultCurrency,
      publishedAt: body.status === "ACTIVE" ? new Date() : null,
      seoMetadata: body.seo ? { create: body.seo } : undefined,
      tags: body.tagIds.length ? { create: body.tagIds.map((tagId) => ({ tagId })) } : undefined,
      galleries: body.gallery.length
        ? {
            create: body.gallery.map((image) => ({ mediaAssetId: image.mediaAssetId, position: image.position, altText: image.altText })),
          }
        : undefined,
      relatedSource: body.relatedProductIds.length
        ? {
            create: body.relatedProductIds.map((targetProductId, index) => ({ targetProductId, position: index })),
          }
        : undefined,
    } as any,
    include: {
      seoMetadata: true,
      tags: { include: { tag: true } },
      galleries: true,
      relatedSource: true,
    },
  });

  if (body.featured) {
    await prisma.featuredProduct.upsert({
      where: { productId: created.id },
      update: {},
      create: { productId: created.id, position: 0 },
    });
  }

  return created;
}

export async function updateProduct(productId: string, rawBody: unknown) {
  const body = updateProductSchema.parse(rawBody);
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

  const seoMetadataUpdate = body.seo
    ? existing.seoMetadataId
      ? { update: body.seo }
      : { create: body.seo }
    : undefined;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
      ...(body.status !== undefined ? { status: body.status, publishedAt: body.status === "ACTIVE" ? (existing.publishedAt ?? new Date()) : null } : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.featured !== undefined ? { featured: body.featured } : {}),
      ...(body.brandId !== undefined ? { brandId: body.brandId } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
      ...(seoMetadataUpdate ? { seoMetadata: seoMetadataUpdate } : {}),
      ...(body.tagIds ? { tags: { deleteMany: {}, create: body.tagIds.map((tagId) => ({ tagId })) } } : {}),
      ...(body.relatedProductIds ? { relatedSource: { deleteMany: {}, create: body.relatedProductIds.map((targetProductId, index) => ({ targetProductId, position: index })) } } : {}),
      ...(body.gallery ? { galleries: { deleteMany: {}, create: body.gallery.map((image) => ({ mediaAssetId: image.mediaAssetId, position: image.position, altText: image.altText })) } } : {}),
    } as any,
    include: {
      seoMetadata: true,
      tags: { include: { tag: true } },
      galleries: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
      relatedSource: true,
    },
  });

  if (body.featured === true) {
    await prisma.featuredProduct.upsert({ where: { productId }, update: {}, create: { productId, position: 0 } });
  }
  if (body.featured === false) {
    await prisma.featuredProduct.deleteMany({ where: { productId } });
  }

  return updated;
}

export async function createVariant(productId: string, rawBody: unknown) {
  const body = createVariantSchema.parse(rawBody);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

  return prisma.productVariant.create({
    data: {
      productId,
      title: body.title,
      sku: body.sku,
      barcode: body.barcode,
      price: body.price,
      salePrice: body.salePrice,
      costPrice: body.costPrice,
      currency: body.currency,
      trackInventory: body.trackInventory,
      allowBackorder: body.allowBackorder,
      backorderLimit: body.backorderLimit,
      outOfStockBehavior: body.outOfStockBehavior,
      isActive: body.isActive,
      inventoryLevel: {
        create: {
          quantityOnHand: body.quantityOnHand,
          lowStockThreshold: body.lowStockThreshold,
        },
      },
      attributeValues: {
        create: body.attributes.map((attr) => ({
          attributeId: attr.attributeId,
          optionId: attr.optionId,
        })),
      },
      stockMovements: {
        create: {
          movementType: "INITIAL_STOCK",
          quantityDelta: body.quantityOnHand,
          quantityBefore: 0,
          quantityAfter: body.quantityOnHand,
          reason: "Initial stock set on variant creation",
        },
      },
    },
    include: {
      inventoryLevel: true,
      attributeValues: { include: { attribute: true, option: true } },
      stockMovements: true,
    },
  });
}

export async function updateVariant(variantId: string, rawBody: unknown) {
  const body = updateVariantSchema.parse(rawBody);
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { inventoryLevel: true } });
  if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.sku !== undefined ? { sku: body.sku } : {}),
      ...(body.barcode !== undefined ? { barcode: body.barcode } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
      ...(body.salePrice !== undefined ? { salePrice: body.salePrice } : {}),
      ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.trackInventory !== undefined ? { trackInventory: body.trackInventory } : {}),
      ...(body.allowBackorder !== undefined ? { allowBackorder: body.allowBackorder } : {}),
      ...(body.backorderLimit !== undefined ? { backorderLimit: body.backorderLimit } : {}),
      ...(body.outOfStockBehavior !== undefined ? { outOfStockBehavior: body.outOfStockBehavior } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.attributes
        ? {
            attributeValues: {
              deleteMany: {},
              create: body.attributes.map((attr) => ({ attributeId: attr.attributeId, optionId: attr.optionId })),
            },
          }
        : {}),
      ...((body.quantityOnHand !== undefined || body.lowStockThreshold !== undefined)
        ? {
            inventoryLevel: {
              upsert: {
                create: {
                  quantityOnHand: body.quantityOnHand ?? 0,
                  lowStockThreshold: body.lowStockThreshold ?? 5,
                },
                update: {
                  ...(body.quantityOnHand !== undefined ? { quantityOnHand: body.quantityOnHand } : {}),
                  ...(body.lowStockThreshold !== undefined ? { lowStockThreshold: body.lowStockThreshold } : {}),
                },
              },
            },
          }
        : {}),
    },
    include: {
      inventoryLevel: true,
      attributeValues: { include: { attribute: true, option: true } },
    },
  });

  return updated;
}

export async function bulkProductAction(rawBody: unknown) {
  const body = bulkProductActionSchema.parse(rawBody);

  if (body.action === "delete") {
    const deleted = await prisma.product.deleteMany({ where: { id: { in: body.productIds } } });
    return { count: deleted.count, action: body.action };
  }

  if (body.action === "set_status") {
    if (!body.status) throw new AppError(400, "Missing status", "VALIDATION_ERROR");
    const updated = await prisma.product.updateMany({ where: { id: { in: body.productIds } }, data: { status: body.status } });
    return { count: updated.count, action: body.action };
  }

  if (body.action === "set_visibility") {
    if (!body.visibility) throw new AppError(400, "Missing visibility", "VALIDATION_ERROR");
    const updated = await prisma.product.updateMany({ where: { id: { in: body.productIds } }, data: { visibility: body.visibility } });
    return { count: updated.count, action: body.action };
  }

  if (body.action === "set_featured") {
    if (body.featured === undefined) throw new AppError(400, "Missing featured", "VALIDATION_ERROR");
    const updated = await prisma.product.updateMany({ where: { id: { in: body.productIds } }, data: { featured: body.featured } });
    if (body.featured) {
      await prisma.featuredProduct.createMany({
        data: body.productIds.map((productId, index) => ({ productId, position: index })),
        skipDuplicates: true,
      });
    } else {
      await prisma.featuredProduct.deleteMany({ where: { productId: { in: body.productIds } } });
    }
    return { count: updated.count, action: body.action };
  }

  throw new AppError(400, "Unsupported action", "VALIDATION_ERROR");
}
