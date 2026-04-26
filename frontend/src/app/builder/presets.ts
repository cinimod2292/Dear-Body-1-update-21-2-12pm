import { BuilderSectionType } from "./types";

export type SectionPreset = {
  id: string;
  name: string;
  description: string;
  sectionType: BuilderSectionType;
  icon: string;
  defaultProps: Record<string, unknown>;
};

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: "hero_centered",
    name: "Hero · Centered",
    description: "Centered headline with stacked CTAs",
    sectionType: "hero_banner",
    icon: "🖼️",
    defaultProps: { title: "Feel good in your skin", subtitle: "Body care essentials made simple.", layout: "centered", tone: "soft", primaryButtonText: "Shop now", primaryButtonHref: "/shop", secondaryButtonText: "Learn more", secondaryButtonHref: "/about" },
  },
  {
    id: "hero_image_left",
    name: "Hero · Image Left",
    description: "Split hero with image emphasis on left",
    sectionType: "hero_banner",
    icon: "🖼️",
    defaultProps: { title: "Dare to be vibrant", subtitle: "Discover our bold collection.", layout: "image_left", tone: "warm", primaryButtonText: "Shop now", primaryButtonHref: "/shop" },
  },
  {
    id: "hero_image_right",
    name: "Hero · Image Right",
    description: "Classic split hero with image right",
    sectionType: "hero_banner",
    icon: "🖼️",
    defaultProps: { title: "Dare to be vibrant", subtitle: "Discover our bold collection.", layout: "image_right", tone: "clean", primaryButtonText: "Shop now", primaryButtonHref: "/shop" },
  },
  {
    id: "featured_latest",
    name: "Products · Latest",
    description: "Auto-show latest products",
    sectionType: "featured_products",
    icon: "🛍️",
    defaultProps: { title: "Latest products", subtitle: "New arrivals this week", mode: "latest", limit: 8, buttonText: "Shop all", buttonHref: "/shop" },
  },
  {
    id: "featured_collection",
    name: "Products · Featured",
    description: "Show featured product set",
    sectionType: "featured_products",
    icon: "🛍️",
    defaultProps: { title: "Featured picks", subtitle: "Hand-picked bestsellers", mode: "featured", limit: 8, buttonText: "Browse collection", buttonHref: "/shop" },
  },
  {
    id: "featured_manual",
    name: "Products · Manual",
    description: "Select products manually",
    sectionType: "featured_products",
    icon: "🛍️",
    defaultProps: { title: "Curated products", subtitle: "Chosen by your team", mode: "manual", productIds: [], limit: 8, buttonText: "Shop now", buttonHref: "/shop" },
  },
  {
    id: "image_text_left",
    name: "Image + Text · Left",
    description: "Image on left, copy on right",
    sectionType: "image_text",
    icon: "📝",
    defaultProps: { title: "Body care for everyday confidence", body: "Craft your routine.", layout: "image_left", tone: "clean", buttonText: "Learn more", buttonHref: "/about" },
  },
  {
    id: "image_text_right",
    name: "Image + Text · Right",
    description: "Image on right, copy on left",
    sectionType: "image_text",
    icon: "📝",
    defaultProps: { title: "Body care for everyday confidence", body: "Craft your routine.", layout: "image_right", tone: "clean", buttonText: "Learn more", buttonHref: "/about" },
  },
  {
    id: "benefits_3col",
    name: "Benefits · 3 Column",
    description: "Trust icons in three columns",
    sectionType: "benefit_icons",
    icon: "✅",
    defaultProps: { title: "Why shoppers choose Dear Body", columns: "3", items: [{ icon: "sparkles", title: "Premium scents", text: "Layerable fragrances" }, { icon: "heart", title: "Skin-first", text: "Comfort-first care" }, { icon: "truck", title: "Fast shipping", text: "Quick delivery" }] },
  },
  {
    id: "benefits_4col",
    name: "Benefits · 4 Column",
    description: "Expanded benefits in four columns",
    sectionType: "benefit_icons",
    icon: "✅",
    defaultProps: { title: "Why shoppers choose Dear Body", columns: "4", items: [{ icon: "sparkles", title: "Premium scents", text: "Layerable fragrances" }, { icon: "heart", title: "Skin-first", text: "Comfort-first care" }, { icon: "truck", title: "Fast shipping", text: "Quick delivery" }, { icon: "shield", title: "Quality tested", text: "Consistent quality" }] },
  },
  {
    id: "promo_sale",
    name: "Promo · Sale",
    description: "General sale promotion",
    sectionType: "promo_banner",
    icon: "🏷️",
    defaultProps: { text: "Seasonal sale — save 30%", buttonText: "Shop sale", buttonHref: "/shop", tone: "warm" },
  },
  {
    id: "promo_delivery",
    name: "Promo · Free Delivery",
    description: "Shipping-focused promotion",
    sectionType: "promo_banner",
    icon: "🏷️",
    defaultProps: { text: "Free delivery on orders over R500", buttonText: "Start shopping", buttonHref: "/shop", tone: "clean" },
  },
  {
    id: "promo_newsletter",
    name: "Promo · Newsletter",
    description: "Grow your subscriber base",
    sectionType: "promo_banner",
    icon: "🏷️",
    defaultProps: { text: "Get 10% off your first order", buttonText: "Join newsletter", buttonHref: "/contact", tone: "soft" },
  },
];
