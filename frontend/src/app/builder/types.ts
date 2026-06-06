export type BuilderPageKey =
  | "home"
  | "about"
  | "contact"
  | "sale"
  | "landing"
  | "brand"
  | "category"
  | "faq"
  | "delivery"
  | "returns"
  | "campaign";

export type BuilderSectionType =
  | "hero_banner"
  | "featured_products"
  | "image_text"
  | "benefit_icons"
  | "promo_banner"
  | "rich_text"
  | "faq_accordion"
  | "newsletter_signup"
  | "testimonials"
  | "trust_badges"
  | "countdown_banner"
  | "image_gallery"
  | "video_banner"
  | "icon_features"
  | "contact_cta"
  | "spacer";

export type BuilderSection = {
  id: string;
  type: BuilderSectionType;
  enabled: boolean;
  props: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type BuilderSeo = {
  title?: string;
  description?: string;
  ogImage?: string;
};

export type BuilderPageContent = {
  sections: BuilderSection[];
  seo?: BuilderSeo;
};

export type BuilderPageRecord = {
  pageKey: BuilderPageKey;
  publishedContent: BuilderPageContent;
  draftContent: BuilderPageContent;
  version: number;
  publishedAt?: string | null;
  publishedBy?: string | null;
  updatedAt?: string;
  updatedBy?: string | null;
};

export type BuilderHistoryEntry = {
  version: number;
  publishedAt: string;
  publishedBy?: string | null;
};

export type BenefitIconName = "sparkles" | "shield" | "heart" | "leaf" | "truck";

export type BenefitItem = {
  icon: BenefitIconName;
  title: string;
  text?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type TestimonialItem = {
  quote: string;
  author: string;
  role?: string;
  rating?: number;
};

export type GalleryImage = {
  url: string;
  alt?: string;
};

export type TrustBadgeIconName =
  | "lock"
  | "credit_card"
  | "money_back"
  | "fast_shipping"
  | "package"
  | "award"
  | "star"
  | "shield";

export type TrustBadgeItem = {
  icon: TrustBadgeIconName;
  label: string;
};

export type FeatureIconName =
  | "check"
  | "star"
  | "zap"
  | "gift"
  | "globe"
  | "award"
  | "clock"
  | "sparkles"
  | "shield"
  | "heart"
  | "leaf"
  | "truck";

export type FeatureItem = {
  icon: FeatureIconName;
  title: string;
  description?: string;
};

export type EditableField = {
  type:
    | "text"
    | "textarea"
    | "image"
    | "url"
    | "select"
    | "boolean"
    | "number"
    | "benefit_items"
    | "faq_items"
    | "testimonial_items"
    | "gallery_images"
    | "trust_badge_items"
    | "feature_items";
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
};
