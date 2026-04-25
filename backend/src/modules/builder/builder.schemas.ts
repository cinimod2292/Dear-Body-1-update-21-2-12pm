import { z } from "zod";

export const BUILDER_PAGE_KEYS = ["home"] as const;
export type BuilderPageKey = (typeof BUILDER_PAGE_KEYS)[number];

export const BUILDER_SECTION_TYPES = [
  "hero_banner",
  "featured_products",
  "image_text",
  "benefit_icons",
  "promo_banner",
] as const;

const MAX_SECTIONS = 30;
const MAX_TEXT = 500;

function hasScriptTag(value: string) {
  return /<\s*script\b/i.test(value);
}

const safeText = z.string().max(MAX_TEXT).refine((value) => !hasScriptTag(value), "Script tags are not allowed");

const safeUrl = z.string().max(2048).refine((value) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/")) return true;
  if (trimmed.startsWith("#")) return true;
  if (/^https:\/\//i.test(trimmed)) return true;
  return false;
}, "Only relative URLs, hash links, and https URLs are allowed").refine((value) => !/^\s*(javascript|data):/i.test(value), "Unsafe URL scheme");

const heroBannerPropsSchema = z.object({
  eyebrow: safeText.optional(),
  title: safeText.min(1),
  subtitle: safeText.optional(),
  imageUrl: safeUrl.optional(),
  imageAlt: safeText.optional(),
  primaryButtonText: safeText.optional(),
  primaryButtonHref: safeUrl.optional(),
  secondaryButtonText: safeText.optional(),
  secondaryButtonHref: safeUrl.optional(),
  layout: z.enum(["image_right", "image_left", "centered"]).default("image_right"),
  tone: z.enum(["soft", "warm", "clean", "bold"]).default("soft"),
});

const featuredProductsPropsSchema = z.object({
  title: safeText.min(1),
  subtitle: safeText.optional(),
  mode: z.enum(["manual", "latest", "featured"]).default("latest"),
  productIds: z.array(z.string().min(1)).max(20).optional(),
  limit: z.number().int().min(1).max(12).default(8),
  buttonText: safeText.optional(),
  buttonHref: safeUrl.optional(),
});

const imageTextPropsSchema = z.object({
  title: safeText.min(1),
  body: safeText.optional(),
  imageUrl: safeUrl.optional(),
  imageAlt: safeText.optional(),
  buttonText: safeText.optional(),
  buttonHref: safeUrl.optional(),
  layout: z.enum(["image_left", "image_right"]).default("image_right"),
  tone: z.enum(["soft", "warm", "clean", "bold"]).default("clean"),
});

const benefitIconItemSchema = z.object({
  icon: z.enum(["sparkles", "shield", "heart", "leaf", "truck"]),
  title: safeText.min(1),
  text: safeText.optional(),
});

const benefitIconsPropsSchema = z.object({
  title: safeText.min(1),
  columns: z.enum(["3", "4"]).default("3"),
  items: z.array(benefitIconItemSchema).min(1).max(8),
});

const promoBannerPropsSchema = z.object({
  text: safeText.min(1),
  buttonText: safeText.optional(),
  buttonHref: safeUrl.optional(),
  tone: z.enum(["soft", "warm", "clean", "bold"]).default("warm"),
});

const sectionPropsByTypeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero_banner"), props: heroBannerPropsSchema }),
  z.object({ type: z.literal("featured_products"), props: featuredProductsPropsSchema }),
  z.object({ type: z.literal("image_text"), props: imageTextPropsSchema }),
  z.object({ type: z.literal("benefit_icons"), props: benefitIconsPropsSchema }),
  z.object({ type: z.literal("promo_banner"), props: promoBannerPropsSchema }),
]);

export const builderSectionSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(BUILDER_SECTION_TYPES),
  enabled: z.boolean().default(true),
  props: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((section, ctx) => {
  const result = sectionPropsByTypeSchema.safeParse({ type: section.type, props: section.props });
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: ["props", ...issue.path],
      });
    }
  }
});

export const builderPageContentSchema = z.object({
  sections: z.array(builderSectionSchema).max(MAX_SECTIONS),
});

export const builderPageSchema = z.object({
  pageKey: z.enum(BUILDER_PAGE_KEYS),
  publishedContent: builderPageContentSchema,
  draftContent: builderPageContentSchema,
  version: z.number().int().min(1).default(1),
  publishedAt: z.string().datetime().nullable().optional(),
  publishedBy: z.string().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.string().nullable().optional(),
});

export const updateBuilderDraftSchema = z.object({
  content: builderPageContentSchema,
});

export function validatePageKey(value: string): BuilderPageKey {
  const parsed = z.enum(BUILDER_PAGE_KEYS).safeParse(value);
  if (!parsed.success) {
    throw new Error("Unsupported page key");
  }
  return parsed.data;
}
