import { ComponentType } from "react";
import { BuilderSectionType } from "./types";
import { HeroBannerSection } from "./sections/HeroBannerSection";
import { FeaturedProductsSection } from "./sections/FeaturedProductsSection";
import { ImageTextSection } from "./sections/ImageTextSection";
import { BenefitIconsSection } from "./sections/BenefitIconsSection";
import { PromoBannerSection } from "./sections/PromoBannerSection";
import { RichTextSection } from "./sections/RichTextSection";
import { FaqAccordionSection } from "./sections/FaqAccordionSection";
import { NewsletterSignupSection } from "./sections/NewsletterSignupSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
import { TrustBadgesSection } from "./sections/TrustBadgesSection";
import { CountdownBannerSection } from "./sections/CountdownBannerSection";
import { ImageGallerySection } from "./sections/ImageGallerySection";
import { VideoBannerSection } from "./sections/VideoBannerSection";
import { IconFeaturesSection } from "./sections/IconFeaturesSection";
import { ContactCtaSection } from "./sections/ContactCtaSection";
import { SpacerSection } from "./sections/SpacerSection";
import { AnnouncementBarSection } from "./sections/AnnouncementBarSection";
import { StatsBarSection } from "./sections/StatsBarSection";
import { IngredientHighlightsSection } from "./sections/IngredientHighlightsSection";
import { DEAR_BODY_SECTION_META, DEAR_BODY_SECTION_META_LIST } from "./registry.meta";

const sectionComponents: Record<BuilderSectionType, ComponentType<any>> = {
  hero_banner: HeroBannerSection,
  featured_products: FeaturedProductsSection,
  image_text: ImageTextSection,
  benefit_icons: BenefitIconsSection,
  promo_banner: PromoBannerSection,
  rich_text: RichTextSection,
  faq_accordion: FaqAccordionSection,
  newsletter_signup: NewsletterSignupSection,
  testimonials: TestimonialsSection,
  trust_badges: TrustBadgesSection,
  countdown_banner: CountdownBannerSection,
  image_gallery: ImageGallerySection,
  video_banner: VideoBannerSection,
  icon_features: IconFeaturesSection,
  contact_cta: ContactCtaSection,
  spacer: SpacerSection,
  announcement_bar: AnnouncementBarSection,
  stats_bar: StatsBarSection,
  ingredient_highlights: IngredientHighlightsSection,
};

export const dearBodySectionRegistry = Object.fromEntries(
  (Object.keys(sectionComponents) as BuilderSectionType[]).map((type) => [
    type,
    { ...DEAR_BODY_SECTION_META[type], component: sectionComponents[type] },
  ]),
) as Record<BuilderSectionType, (typeof DEAR_BODY_SECTION_META)[BuilderSectionType] & { component: ComponentType<any> }>;

export const DEAR_BODY_SECTION_LIBRARY = DEAR_BODY_SECTION_META_LIST.map((entry) => ({
  ...entry,
  component: sectionComponents[entry.type],
}));
