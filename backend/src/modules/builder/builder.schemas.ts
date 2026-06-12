import { z } from "zod";

export const BUILDER_PAGE_KEYS = [
  "home",
  "about",
  "contact",
  "sale",
  "landing",
  "brand",
  "category",
  "faq",
  "delivery",
  "returns",
  "campaign",
] as const;
export type BuilderPageKey = (typeof BUILDER_PAGE_KEYS)[number];

export const BUILDER_SECTION_TYPES = [
  "hero_banner",
  "featured_products",
  "image_text",
  "benefit_icons",
  "promo_banner",
  "rich_text",
  "faq_accordion",
  "newsletter_signup",
  "testimonials",
  "trust_badges",
  "countdown_banner",
  "image_gallery",
  "video_banner",
  "icon_features",
  "contact_cta",
  "spacer",
  "announcement_bar",
  "stats_bar",
  "ingredient_highlights",
  "contact_form",
  "social_links",
] as const;

const MAX_SECTIONS = 40;
const MAX_TEXT = 500;
const MAX_BODY_TEXT = 2000;
const MAX_RICH_TEXT = 5000;

function hasScriptTag(value: string) {
  return /<\s*script\b/i.test(value);
}

const safeText = z
  .string()
  .max(MAX_TEXT)
  .refine((value) => !hasScriptTag(value), "Script tags are not allowed");

const safeBodyText = z
  .string()
  .max(MAX_BODY_TEXT)
  .refine((value) => !hasScriptTag(value), "Script tags are not allowed");

const safeUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("/")) return true;
    if (trimmed.startsWith("#")) return true;
    if (/^https:\/\//i.test(trimmed)) return true;
    return false;
  }, "Only relative URLs, hash links, and https URLs are allowed")
  .refine(
    (value) => !/^\s*(javascript|data):/i.test(value),
    "Unsafe URL scheme",
  );

// ─── Existing section schemas ────────────────────────────────────────────────

const heroBannerPropsSchema = z.object({
  eyebrow: safeText.optional(),
  title: safeText.min(1),
  subtitle: safeText.optional(),
  imageAssetId: safeText.optional(),
  imageUrl: safeUrl.optional(),
  imageMobileUrl: safeUrl.optional(),
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
  body: safeBodyText.optional(),
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

// ─── New section schemas ─────────────────────────────────────────────────────

const richTextPropsSchema = z.object({
  title: safeText.optional(),
  content: z
    .string()
    .max(MAX_RICH_TEXT)
    .refine((v) => !hasScriptTag(v), "Script tags are not allowed")
    .optional(),
  alignment: z.enum(["left", "center"]).default("left"),
  maxWidth: z.enum(["narrow", "standard", "wide"]).default("standard"),
  tone: z.enum(["white", "soft", "warm", "muted"]).default("white"),
});

const faqItemSchema = z.object({
  question: safeText.min(1),
  answer: z
    .string()
    .max(2000)
    .refine((v) => !hasScriptTag(v), "Script tags are not allowed"),
});

const faqAccordionPropsSchema = z.object({
  title: safeText.optional(),
  subtitle: safeText.optional(),
  items: z.array(faqItemSchema).min(1).max(20),
  tone: z.enum(["white", "soft", "muted"]).default("white"),
});

const newsletterSignupPropsSchema = z.object({
  title: safeText.optional(),
  subtitle: safeText.optional(),
  placeholder: safeText.optional(),
  buttonText: safeText.optional(),
  buttonHref: safeUrl.optional(),
  disclaimer: safeText.optional(),
  tone: z.enum(["soft", "warm", "bold", "muted"]).default("soft"),
});

const testimonialItemSchema = z.object({
  quote: z
    .string()
    .max(1000)
    .refine((v) => !hasScriptTag(v), "Script tags are not allowed"),
  author: safeText.min(1),
  role: safeText.optional(),
  rating: z.number().int().min(1).max(5).default(5),
});

const testimonialsPropsSchema = z.object({
  title: safeText.optional(),
  items: z.array(testimonialItemSchema).min(1).max(12),
  tone: z.enum(["white", "soft", "muted"]).default("white"),
});

const trustBadgeItemSchema = z.object({
  icon: z.enum(["lock", "credit_card", "money_back", "fast_shipping", "package", "award", "star", "shield"]),
  label: safeText.min(1),
});

const trustBadgesPropsSchema = z.object({
  title: safeText.optional(),
  items: z.array(trustBadgeItemSchema).min(1).max(8),
  layout: z.enum(["row", "grid"]).default("row"),
  tone: z.enum(["white", "muted"]).default("white"),
});

const countdownBannerPropsSchema = z.object({
  headline: safeText.optional(),
  subtext: safeText.optional(),
  endDate: z.string().max(50).optional(),
  buttonText: safeText.optional(),
  buttonHref: safeUrl.optional(),
  tone: z.enum(["warm", "bold", "soft", "clean"]).default("warm"),
});

const galleryImageItemSchema = z.object({
  url: safeUrl,
  alt: safeText.optional(),
});

const imageGalleryPropsSchema = z.object({
  title: safeText.optional(),
  images: z.array(galleryImageItemSchema).max(24),
  columns: z.enum(["2", "3", "4"]).default("3"),
  tone: z.enum(["white", "muted"]).default("white"),
});

const videoBannerPropsSchema = z.object({
  title: safeText.optional(),
  subtitle: safeText.optional(),
  videoUrl: safeUrl.optional(),
  posterUrl: safeUrl.optional(),
  overlayOpacity: z.enum(["light", "medium", "dark"]).default("medium"),
  buttonText: safeText.optional(),
  buttonHref: safeUrl.optional(),
  tone: z.enum(["soft", "bold", "clean"]).default("bold"),
});

const featureItemSchema = z.object({
  icon: z.enum(["check", "star", "zap", "gift", "globe", "award", "clock", "sparkles", "shield", "heart", "leaf", "truck"]),
  title: safeText.min(1),
  description: safeText.optional(),
});

const iconFeaturesPropsSchema = z.object({
  title: safeText.optional(),
  subtitle: safeText.optional(),
  columns: z.enum(["2", "3", "4"]).default("3"),
  items: z.array(featureItemSchema).min(1).max(12),
  tone: z.enum(["white", "soft", "muted"]).default("white"),
});

const contactCtaPropsSchema = z.object({
  title: safeText.optional(),
  subtitle: safeText.optional(),
  email: safeText.optional(),
  phone: safeText.optional(),
  buttonText: safeText.optional(),
  buttonHref: safeUrl.optional(),
  tone: z.enum(["dark", "soft", "warm"]).default("dark"),
});

const spacerPropsSchema = z.object({
  height: z.enum(["sm", "md", "lg", "xl"]).default("md"),
  showDivider: z.boolean().default(false),
  tone: z.enum(["white", "muted"]).default("white"),
});

const announcementBarPropsSchema = z.object({
  text: safeText.min(1),
  linkText: safeText.optional(),
  linkHref: safeUrl.optional(),
  tone: z.enum(["pink", "dark", "warm", "light"]).default("pink"),
});

const statItemSchema = z.object({
  value: safeText.min(1),
  label: safeText.min(1),
});

const statsBarPropsSchema = z.object({
  title: safeText.optional(),
  items: z.array(statItemSchema).min(1).max(8),
  tone: z.enum(["white", "dark", "soft", "pink"]).default("white"),
});

const ingredientItemSchema = z.object({
  icon: z.enum(["leaf", "droplets", "sun", "sparkles", "flask", "wind"]),
  name: safeText.min(1),
  benefit: safeText.min(1),
});

const ingredientHighlightsPropsSchema = z.object({
  title: safeText.optional(),
  subtitle: safeText.optional(),
  items: z.array(ingredientItemSchema).min(1).max(12),
  tone: z.enum(["white", "soft", "dark"]).default("white"),
});

const contactFormPropsSchema = z.object({
  title: safeText.optional(),
  subtitle: safeText.optional(),
  showName: z.boolean().default(true),
  showSubject: z.boolean().default(true),
  submitText: safeText.optional(),
  successTitle: safeText.optional(),
  successMessage: safeText.optional(),
  tone: z.enum(["white", "soft", "muted"]).default("white"),
});

const socialLinksPropsSchema = z.object({
  title: safeText.optional(),
  instagram: safeUrl.optional(),
  tiktok: safeUrl.optional(),
  facebook: safeUrl.optional(),
  pinterest: safeUrl.optional(),
  twitter: safeUrl.optional(),
  youtube: safeUrl.optional(),
  whatsapp: safeUrl.optional(),
  style: z.enum(["pills", "icons"]).default("pills"),
  tone: z.enum(["white", "dark", "soft"]).default("white"),
});

// ─── Discriminated union ─────────────────────────────────────────────────────

const sectionPropsByTypeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero_banner"), props: heroBannerPropsSchema }),
  z.object({ type: z.literal("featured_products"), props: featuredProductsPropsSchema }),
  z.object({ type: z.literal("image_text"), props: imageTextPropsSchema }),
  z.object({ type: z.literal("benefit_icons"), props: benefitIconsPropsSchema }),
  z.object({ type: z.literal("promo_banner"), props: promoBannerPropsSchema }),
  z.object({ type: z.literal("rich_text"), props: richTextPropsSchema }),
  z.object({ type: z.literal("faq_accordion"), props: faqAccordionPropsSchema }),
  z.object({ type: z.literal("newsletter_signup"), props: newsletterSignupPropsSchema }),
  z.object({ type: z.literal("testimonials"), props: testimonialsPropsSchema }),
  z.object({ type: z.literal("trust_badges"), props: trustBadgesPropsSchema }),
  z.object({ type: z.literal("countdown_banner"), props: countdownBannerPropsSchema }),
  z.object({ type: z.literal("image_gallery"), props: imageGalleryPropsSchema }),
  z.object({ type: z.literal("video_banner"), props: videoBannerPropsSchema }),
  z.object({ type: z.literal("icon_features"), props: iconFeaturesPropsSchema }),
  z.object({ type: z.literal("contact_cta"), props: contactCtaPropsSchema }),
  z.object({ type: z.literal("spacer"), props: spacerPropsSchema }),
  z.object({ type: z.literal("announcement_bar"), props: announcementBarPropsSchema }),
  z.object({ type: z.literal("stats_bar"), props: statsBarPropsSchema }),
  z.object({ type: z.literal("ingredient_highlights"), props: ingredientHighlightsPropsSchema }),
  z.object({ type: z.literal("contact_form"), props: contactFormPropsSchema }),
  z.object({ type: z.literal("social_links"), props: socialLinksPropsSchema }),
]);

export const builderSectionSchema = z
  .object({
    id: z.string().min(1).max(128),
    type: z.enum(BUILDER_SECTION_TYPES),
    enabled: z.boolean().default(true),
    props: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((section, ctx) => {
    const result = sectionPropsByTypeSchema.safeParse({
      type: section.type,
      props: section.props,
    });
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

const builderSeoSchema = z
  .object({
    title: z.string().max(120).optional(),
    description: z.string().max(320).optional(),
    ogImage: safeUrl.optional(),
  })
  .optional();

export const builderPageContentSchema = z.object({
  sections: z.array(builderSectionSchema).max(MAX_SECTIONS),
  seo: builderSeoSchema,
});

export const builderHistoryEntrySchema = z.object({
  version: z.number().int().min(1),
  publishedAt: z.string().datetime(),
  publishedBy: z.string().nullable().optional(),
  content: builderPageContentSchema,
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
  history: z.array(builderHistoryEntrySchema).max(20).optional(),
});

export const restoreBuilderVersionSchema = z.object({
  version: z.number().int().min(1),
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
