import { z } from "zod";
import { seoMetadataSchema } from "../../lib/seo.js";

export const productFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "publishedAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  visibility: z.enum(["PUBLIC", "HIDDEN", "PRIVATE"]).optional(),
  brandId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  featured: z.coerce.boolean().optional(),
  tag: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  visibility: z.enum(["PUBLIC", "HIDDEN", "PRIVATE"]).default("PUBLIC"),
  featured: z.boolean().default(false),
  brandId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  defaultCurrency: z.string().length(3).default("USD"),
  hoverImageId: z.string().cuid().nullable().optional(),
  seo: seoMetadataSchema.optional(),
  tagIds: z.array(z.string().cuid()).default([]),
  relatedProductIds: z.array(z.string().cuid()).default([]),
  gallery: z.array(z.object({ mediaAssetId: z.string().cuid(), position: z.number().int().min(0).default(0), altText: z.string().optional() })).default([]),
});

export const updateProductSchema = createProductSchema.partial();

export const createVariantSchema = z.object({
  title: z.string().optional(),
  sku: z.string().min(3),
  barcode: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative().optional(),
  costPrice: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).default("USD"),
  trackInventory: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  backorderLimit: z.number().int().nonnegative().optional(),
  outOfStockBehavior: z.enum(["DENY_ORDERS", "ALLOW_BACKORDER", "PREORDER"]).default("DENY_ORDERS"),
  isActive: z.boolean().default(true),
  quantityOnHand: z.number().int().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  attributes: z.array(z.object({ attributeId: z.string().cuid(), optionId: z.string().cuid() })).default([]),
});

export const updateVariantSchema = createVariantSchema.partial();

export const bulkProductActionSchema = z.object({
  productIds: z.array(z.string().cuid()).min(1),
  action: z.enum(["set_status", "set_visibility", "set_featured", "delete"]),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  visibility: z.enum(["PUBLIC", "HIDDEN", "PRIVATE"]).optional(),
  featured: z.boolean().optional(),
});

const optionalText = z.string().trim().optional();

export const importProductRowSchema = z.object({
  sku: z.string().trim(),
  product_name: z.string().trim(),
  price: z.string().trim(),
  product_slug: optionalText,
  short_description: optionalText,
  description: optionalText,
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  visibility: z.enum(["PUBLIC", "HIDDEN", "PRIVATE"]).optional(),
  featured: z.union([z.string(), z.boolean()]).optional(),
  brand_name: optionalText,
  parent_category_name: optionalText,
  category_name: optionalText,
  quantity_on_hand: optionalText,
  low_stock_threshold: optionalText,
  sale_price: optionalText,
  cost_price: optionalText,
  barcode: optionalText,
}).passthrough();

export const importCommitPayloadSchema = z.object({
  rows: z.array(importProductRowSchema).min(1),
});

export const importProductImageRowSchema = z.object({
  sku: z.string().trim(),
  image_url: z.string().trim(),
  position: z.string().trim().optional(),
  alt_text: z.string().trim().optional(),
}).passthrough();

export const attachProductImagesSchema = z.object({
  mediaAssetIds: z.array(z.string().cuid()).min(1).max(20),
});
