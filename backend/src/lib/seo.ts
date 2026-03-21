import { z } from "zod";

export const seoMetadataSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(320).optional(),
  canonicalUrl: z.string().url().optional(),
  noIndex: z.boolean().optional(),
  noFollow: z.boolean().optional(),
  ogTitle: z.string().max(70).optional(),
  ogDescription: z.string().max(320).optional(),
  ogImageUrl: z.string().url().optional(),
});

export type SeoMetadataInput = z.infer<typeof seoMetadataSchema>;
