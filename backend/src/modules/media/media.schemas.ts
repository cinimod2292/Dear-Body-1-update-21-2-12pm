import { z } from "zod";

export const createUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive().max(50 * 1024 * 1024),
  kind: z.enum(["IMAGE", "VIDEO", "FILE"]).default("IMAGE"),
});

export const finalizeUploadSchema = z.object({
  storageKey: z.string().min(1),
  publicUrl: z.string().url().optional(),
  altText: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
