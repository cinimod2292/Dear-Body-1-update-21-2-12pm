import { ComponentType } from "react";
import { BuilderSectionType } from "./types";
import { HeroBannerSection } from "./sections/HeroBannerSection";
import { FeaturedProductsSection } from "./sections/FeaturedProductsSection";
import { ImageTextSection } from "./sections/ImageTextSection";
import { BenefitIconsSection } from "./sections/BenefitIconsSection";
import { PromoBannerSection } from "./sections/PromoBannerSection";
import { DEAR_BODY_SECTION_META, DEAR_BODY_SECTION_META_LIST } from "./registry.meta";

const sectionComponents: Record<BuilderSectionType, ComponentType<any>> = {
  hero_banner: HeroBannerSection,
  featured_products: FeaturedProductsSection,
  image_text: ImageTextSection,
  benefit_icons: BenefitIconsSection,
  promo_banner: PromoBannerSection,
};

export const dearBodySectionRegistry = {
  hero_banner: { ...DEAR_BODY_SECTION_META.hero_banner, component: sectionComponents.hero_banner },
  featured_products: { ...DEAR_BODY_SECTION_META.featured_products, component: sectionComponents.featured_products },
  image_text: { ...DEAR_BODY_SECTION_META.image_text, component: sectionComponents.image_text },
  benefit_icons: { ...DEAR_BODY_SECTION_META.benefit_icons, component: sectionComponents.benefit_icons },
  promo_banner: { ...DEAR_BODY_SECTION_META.promo_banner, component: sectionComponents.promo_banner },
};

export const DEAR_BODY_SECTION_LIBRARY = DEAR_BODY_SECTION_META_LIST.map((entry) => ({
  ...entry,
  component: sectionComponents[entry.type],
}));
