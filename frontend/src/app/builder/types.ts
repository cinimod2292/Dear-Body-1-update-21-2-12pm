export type BuilderPageKey = "home";

export type BuilderSectionType =
  | "hero_banner"
  | "featured_products"
  | "image_text"
  | "benefit_icons"
  | "promo_banner";

export type BuilderSection = {
  id: string;
  type: BuilderSectionType;
  enabled: boolean;
  props: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type BuilderPageContent = {
  sections: BuilderSection[];
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

export type BenefitIconName = "sparkles" | "shield" | "heart" | "leaf" | "truck";

export type BenefitItem = {
  icon: BenefitIconName;
  title: string;
  text?: string;
};

export type EditableField = {
  type: "text" | "textarea" | "image" | "url" | "select" | "boolean" | "number" | "benefit_items";
  label: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
};
