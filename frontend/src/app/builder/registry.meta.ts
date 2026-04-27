import { BuilderSectionType, EditableField } from "./types";

export type BuilderRegistryMetaEntry = {
  type: BuilderSectionType;
  displayName: string;
  description: string;
  group: "Hero" | "Products" | "Content" | "Trust/Benefits" | "Promotions";
  icon: string;
  defaultProps: Record<string, unknown>;
  editableSchema: Record<string, EditableField>;
  removable: boolean;
  movable: boolean;
  duplicatable: boolean;
};

export const DEAR_BODY_SECTION_META: Record<BuilderSectionType, BuilderRegistryMetaEntry> = {
  hero_banner: {
    type: "hero_banner",
    displayName: "Hero Banner",
    description: "Top hero section with headline and CTA buttons",
    group: "Hero",
    icon: "🖼️",
    removable: false,
    movable: false,
    duplicatable: false,
    defaultProps: {
      eyebrow: "New Collection",
      title: "Feel good in your skin",
      subtitle: "Body care essentials made simple.",
      primaryButtonText: "Shop Now",
      primaryButtonHref: "/shop",
      secondaryButtonText: "Learn More",
      secondaryButtonHref: "/about",
      layout: "image_right",
      tone: "soft",
    },
    editableSchema: {
      eyebrow: { type: "text", label: "Eyebrow" },
      title: { type: "text", label: "Heading", required: true },
      subtitle: { type: "textarea", label: "Subtitle" },
      imageUrl: { type: "image", label: "Image" },
      primaryButtonText: { type: "text", label: "Primary button text" },
      primaryButtonHref: { type: "url", label: "Primary button link" },
      secondaryButtonText: { type: "text", label: "Secondary button text" },
      secondaryButtonHref: { type: "url", label: "Secondary button link" },
      layout: { type: "select", label: "Layout", options: ["image_right", "image_left", "centered"] },
      tone: { type: "select", label: "Tone", options: ["soft", "clean", "warm", "bold"] },
    },
  },
  featured_products: {
    type: "featured_products",
    displayName: "Featured Products",
    description: "Product grid using existing product cards",
    group: "Products",
    icon: "🛍️",
    removable: true,
    movable: true,
    duplicatable: true,
    defaultProps: {
      title: "Bestselling Products",
      subtitle: "Customer favorites.",
      mode: "latest",
      limit: 8,
      buttonText: "Shop All",
      buttonHref: "/shop",
    },
    editableSchema: {
      title: { type: "text", label: "Title", required: true },
      subtitle: { type: "textarea", label: "Subtitle" },
      mode: { type: "select", label: "Mode", options: ["manual", "latest", "featured"] },
      limit: { type: "number", label: "Item limit", min: 1, max: 12 },
      buttonText: { type: "text", label: "Button text" },
      buttonHref: { type: "url", label: "Button link" },
    },
  },
  image_text: {
    type: "image_text",
    displayName: "Image + Text",
    description: "Split content section with image and copy",
    group: "Content",
    icon: "📝",
    removable: true,
    movable: true,
    duplicatable: true,
    defaultProps: {
      title: "Body care for everyday confidence",
      body: "Made for your routine.",
      buttonText: "Learn More",
      buttonHref: "/about",
      layout: "image_right",
      tone: "clean",
    },
    editableSchema: {
      title: { type: "text", label: "Title", required: true },
      body: { type: "textarea", label: "Body" },
      imageUrl: { type: "image", label: "Image" },
      buttonText: { type: "text", label: "Button text" },
      buttonHref: { type: "url", label: "Button link" },
      layout: { type: "select", label: "Layout", options: ["image_left", "image_right"] },
      tone: { type: "select", label: "Tone", options: ["soft", "clean", "warm", "bold"] },
    },
  },
  benefit_icons: {
    type: "benefit_icons",
    displayName: "Benefit Icons",
    description: "Icon list with key value propositions",
    group: "Trust/Benefits",
    icon: "✅",
    removable: true,
    movable: true,
    duplicatable: true,
    defaultProps: {
      title: "Why shoppers choose Dear Body",
      columns: "4",
      items: [
        { icon: "sparkles", title: "Premium Scents", text: "Layerable fragrances." },
        { icon: "heart", title: "Gentle formulas", text: "Comfort-first body care." },
        { icon: "truck", title: "Fast shipping", text: "Quick local delivery." },
      ],
    },
    editableSchema: {
      title: { type: "text", label: "Title", required: true },
      columns: { type: "select", label: "Columns", options: ["3", "4"] },
    },
  },
  promo_banner: {
    type: "promo_banner",
    displayName: "Promo Banner",
    description: "High-impact promotional strip",
    group: "Promotions",
    icon: "🏷️",
    removable: true,
    movable: true,
    duplicatable: true,
    defaultProps: {
      text: "Limited-time promotion",
      buttonText: "Shop Now",
      buttonHref: "/shop",
      tone: "warm",
    },
    editableSchema: {
      text: { type: "text", label: "Text", required: true },
      buttonText: { type: "text", label: "Button text" },
      buttonHref: { type: "url", label: "Button link" },
      tone: { type: "select", label: "Tone", options: ["soft", "clean", "warm", "bold"] },
    },
  },
};

export const DEAR_BODY_SECTION_META_LIST = Object.values(DEAR_BODY_SECTION_META);
