import { z } from "zod";

export const sectionTypeSchema = z.enum([
  "hero",
  "featured_products",
  "featured_collections",
  "promo_banner",
  "text_block",
  "image_block",
  "cta_block",
  "faq",
  "testimonials",
]);

export const homeSectionSchema = z.object({
  id: z.string().min(1),
  type: sectionTypeSchema,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.record(z.string(), z.any()).default({}),
  enabled: z.boolean().default(true),
  order: z.number().int().nonnegative().default(0),
  status: z.enum(["draft", "published"]).default("published"),
});

export const upsertHomeSectionsSchema = z.object({
  sections: z.array(homeSectionSchema),
});

export const reorderHomeSectionsSchema = z.object({
  sectionIds: z.array(z.string().min(1)).min(1),
});

export const siteConfigSchema = z.object({
  navigation: z.object({
    items: z.array(z.object({ label: z.string().min(1), href: z.string().min(1), enabled: z.boolean().default(true) })).default([]),
  }),
  header: z.object({
    announcementText: z.string().optional(),
    logoUrl: z.string().optional(),
    logo2xUrl: z.string().optional(),
    logoMediaAssetId: z.string().cuid().optional(),
  }),
  footer: z.object({
    copyrightText: z.string().optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).default([]),
  }),
  branding: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    fontFamily: z.string().optional(),
    logoUrl: z.string().optional(),
    logo2xUrl: z.string().optional(),
    logoFooterUrl: z.string().optional(),
    logoMediaAssetId: z.string().cuid().optional(),
    faviconUrl: z.string().optional(),
  }),
  seoDefaults: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    ogImageUrl: z.string().optional(),
  }),
  contactInfo: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  siteStatus: z.object({
    maintenanceMode: z.boolean().default(false),
    comingSoon: z.boolean().default(false),
  }).default({ maintenanceMode: false, comingSoon: false }),
});

export const staticPageSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["draft", "published"]).default("published"),
  seo: z.object({ title: z.string().optional(), description: z.string().optional() }).default({}),
  sections: z.array(homeSectionSchema).default([]),
  content: z.string().default(""),
  updatedAt: z.string().optional(),
});

export const upsertStaticPageSchema = staticPageSchema;
