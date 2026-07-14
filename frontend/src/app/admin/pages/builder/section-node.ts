import type { BuilderSectionType, EditableField } from "../../../builder/types";

export type BuilderRegistryLike = Record<BuilderSectionType, {
  displayName: string;
  description: string;
  icon: string;
  editableSchema: Record<string, EditableField>;
  removable: boolean;
  movable: boolean;
  duplicatable: boolean;
}>;

export type ResolvedInspectorSection<TRegistry extends BuilderRegistryLike = BuilderRegistryLike> = {
  nodeId: string;
  sectionType: BuilderSectionType;
  registryEntry: TRegistry[BuilderSectionType];
  editableSchema: Record<string, EditableField>;
  nodeProps: Record<string, unknown>;
};

const NAME_TO_SECTION_TYPE: Record<string, BuilderSectionType> = {
  HeroCraftSection: "hero_banner",
  FeaturedProductsCraftSection: "featured_products",
  ImageTextCraftSection: "image_text",
  BenefitIconsCraftSection: "benefit_icons",
  PromoBannerCraftSection: "promo_banner",
  RichTextCraftSection: "rich_text",
  FaqAccordionCraftSection: "faq_accordion",
  NewsletterSignupCraftSection: "newsletter_signup",
  TestimonialsCraftSection: "testimonials",
  TrustBadgesCraftSection: "trust_badges",
  CountdownBannerCraftSection: "countdown_banner",
  ImageGalleryCraftSection: "image_gallery",
  VideoBannerCraftSection: "video_banner",
  IconFeaturesCraftSection: "icon_features",
  ContactCtaCraftSection: "contact_cta",
  SpacerCraftSection: "spacer",
  AnnouncementBarCraftSection: "announcement_bar",
  StatsBarCraftSection: "stats_bar",
  IngredientHighlightsCraftSection: "ingredient_highlights",
  ContactFormCraftSection: "contact_form",
  SocialLinksCraftSection: "social_links",
  WhatsAppCtaCraftSection: "whatsapp_cta",
  "Hero Banner": "hero_banner",
  "Featured Products": "featured_products",
  "Image + Text": "image_text",
  "Benefit Icons": "benefit_icons",
  "Promo Banner": "promo_banner",
  "Rich Text": "rich_text",
  "FAQ Accordion": "faq_accordion",
  "Newsletter Signup": "newsletter_signup",
  Testimonials: "testimonials",
  "Trust Badges": "trust_badges",
  "Countdown Banner": "countdown_banner",
  "Countdown Timer": "countdown_banner",
  "Image Gallery": "image_gallery",
  "Video Banner": "video_banner",
  "Icon Features": "icon_features",
  "Contact CTA": "contact_cta",
  Spacer: "spacer",
  "Announcement Bar": "announcement_bar",
  "Stats Bar": "stats_bar",
  "Ingredient Highlights": "ingredient_highlights",
  "Contact Form": "contact_form",
  "Social Links": "social_links",
  "WhatsApp Banner": "whatsapp_cta",
};

const VALID_SECTION_TYPES = new Set<string>([
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
  "whatsapp_cta",
]);

function normalizeSectionType(value: unknown): BuilderSectionType | null {
  if (typeof value === "string" && VALID_SECTION_TYPES.has(value)) {
    return value as BuilderSectionType;
  }
  return null;
}

function getNodeData(node: any) {
  return node?.data ?? node ?? {};
}

function getResolvedName(nodeData: any): string {
  const typeValue = nodeData?.type;
  if (typeof typeValue === "string") return typeValue;
  if (typeof typeValue?.resolvedName === "string") return typeValue.resolvedName;
  if (typeof nodeData?.name === "string") return nodeData.name;
  return "";
}

export function resolveSectionTypeFromNode(node: unknown): BuilderSectionType | null {
  const nodeData = getNodeData(node);

  const customType = normalizeSectionType(nodeData?.custom?.sectionType);
  if (customType) return customType;

  const displayName = String(nodeData?.displayName ?? "").trim();
  if (displayName && NAME_TO_SECTION_TYPE[displayName]) return NAME_TO_SECTION_TYPE[displayName];

  const name = String(nodeData?.name ?? "").trim();
  if (name && NAME_TO_SECTION_TYPE[name]) return NAME_TO_SECTION_TYPE[name];

  const resolved = getResolvedName(nodeData).trim();
  if (resolved && NAME_TO_SECTION_TYPE[resolved]) return NAME_TO_SECTION_TYPE[resolved];

  return null;
}

export function extractSelectedNodeId(selected: unknown): string | null {
  if (typeof selected === "string" && selected.trim()) return selected;

  if (Array.isArray(selected)) {
    const first = selected.find((value) => typeof value === "string" && value.trim());
    return typeof first === "string" ? first : null;
  }

  if (selected && typeof selected === "object") {
    if (typeof (selected as Set<unknown>).values === "function") {
      for (const value of (selected as Set<unknown>).values()) {
        if (typeof value === "string" && value.trim()) return value;
      }
    }

    for (const [key, value] of Object.entries(selected as Record<string, unknown>)) {
      if (value === true && key.trim()) return key;
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return null;
}

export function resolveInspectableSection<TRegistry extends BuilderRegistryLike>(
  nodeId: string | null,
  node: unknown,
  registry: TRegistry,
): ResolvedInspectorSection<TRegistry> | null {
  if (!nodeId) return null;

  const sectionType = resolveSectionTypeFromNode(node);
  if (!sectionType) return null;

  const registryEntry = registry[sectionType];
  if (!registryEntry) return null;

  const nodeData = getNodeData(node);
  const nodeProps = (nodeData?.props ?? {}) as Record<string, unknown>;

  return {
    nodeId,
    sectionType,
    registryEntry,
    editableSchema: registryEntry.editableSchema,
    nodeProps,
  };
}
