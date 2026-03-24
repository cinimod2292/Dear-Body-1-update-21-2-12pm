import { z } from "zod";

export const templateListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  category: z.enum(["ACCOUNT", "ORDER", "PAYMENT", "SHIPPING", "SECURITY", "SUPPORT", "MARKETING", "SYSTEM"]).optional(),
  isEnabled: z.coerce.boolean().optional(),
  q: z.string().optional(),
});

export const upsertTemplateSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  category: z.enum(["ACCOUNT", "ORDER", "PAYMENT", "SHIPPING", "SECURITY", "SUPPORT", "MARKETING", "SYSTEM"]),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  placeholderKeys: z.array(z.string()).default([]),
  isEnabled: z.boolean().default(true),
});

export const patchTemplateSchema = upsertTemplateSchema.partial();

export const previewSchema = z.object({
  sampleData: z.record(z.string(), z.any()).default({}),
});

export const testSendSchema = z.object({
  to: z.string().email(),
  sampleData: z.record(z.string(), z.any()).default({}),
});
