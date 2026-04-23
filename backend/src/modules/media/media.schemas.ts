import { z } from "zod";

export const createUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive().max(50 * 1024 * 1024),
  kind: z.enum(["IMAGE", "VIDEO", "FILE"]).default("IMAGE"),
});

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  sortBy: z.enum(["createdAt", "filename"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  kind: z.enum(["IMAGE", "VIDEO", "FILE"]).optional(),
});

export const finalizeUploadSchema = z.object({
  storageKey: z.string().min(1),
  publicUrl: z.string().url().optional(),
  kind: z.enum(["IMAGE", "VIDEO", "FILE"]).optional(),
  altText: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateMediaAssetSchema = z.object({
  filename: z.string().trim().min(1).max(255).optional(),
  altText: z.string().trim().max(255).nullable().optional(),
});

export const assignMediaToProductSchema = z.object({
  sku: z.string().trim().min(1),
  replaceExisting: z.boolean().optional().default(false),
});

export const unlinkMediaFromProductSchema = z.object({
  sku: z.string().trim().min(1),
});

export const runMediaBackfillSchema = z.object({
  productId: z.string().cuid().optional(),
  assetId: z.string().cuid().optional(),
  force: z.boolean().optional().default(false),
});
