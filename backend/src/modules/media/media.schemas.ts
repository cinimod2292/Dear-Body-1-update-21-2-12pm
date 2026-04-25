import { z } from "zod";

export const createUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive().max(50 * 1024 * 1024),
  kind: z.enum(["IMAGE", "VIDEO", "FILE"]).default("IMAGE"),
}).superRefine((value, ctx) => {
  if (value.kind === "IMAGE" && !value.mimeType.toLowerCase().startsWith("image/")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mimeType"],
      message: "Invalid image file type",
    });
  }
});

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  sortBy: z.enum(["createdAt", "filename"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  kind: z.enum(["IMAGE", "VIDEO", "FILE"]).optional(),
  view: z.enum(["full", "picker"]).optional().default("full"),
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

export const regenerateVariantsBatchSchema = z.object({
  mediaIds: z.array(z.string().cuid()).min(1).max(50),
  concurrency: z.number().int().min(1).max(6).optional(),
});

export const mediaByIdsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
  view: z.enum(["full", "picker"]).optional().default("picker"),
});
