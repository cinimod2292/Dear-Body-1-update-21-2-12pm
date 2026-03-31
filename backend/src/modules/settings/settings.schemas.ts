import { z } from "zod";

export const upsertSettingSchema = z.object({
  scope: z.string().min(1).default("store"),
  key: z.string().min(1),
  value: z.unknown(),
});

export const storageProviderSchema = z.enum(["local", "s3", "cloudflare-r2"]);

export const upsertStorageSettingsSchema = z.object({
  provider: storageProviderSchema,
  bucket: z.string().trim().optional(),
  accountId: z.string().trim().optional(),
  accessKeyId: z.string().trim().optional(),
  secretAccessKey: z.string().trim().optional(),
  endpoint: z.string().trim().optional(),
  publicBaseUrl: z.string().trim().optional(),
  signedUrlTtlSeconds: z.coerce.number().int().positive().max(86_400).optional(),
  forcePathStyle: z.coerce.boolean().optional(),
});
