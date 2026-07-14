import { BuilderPageContent, BuilderSection, BuilderSectionType } from "../../../builder/types";

export type PreviewViewport = "desktop" | "tablet" | "mobile";

export function deepCloneContent(content: BuilderPageContent): BuilderPageContent {
  return JSON.parse(JSON.stringify(content)) as BuilderPageContent;
}

export function createSection(type: BuilderSectionType, defaultProps: Record<string, unknown>): BuilderSection {
  return {
    id: `${type}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    enabled: true,
    props: JSON.parse(JSON.stringify(defaultProps)) as Record<string, unknown>,
  };
}

export function moveSection(sections: BuilderSection[], index: number, direction: -1 | 1): BuilderSection[] {
  const target = index + direction;
  if (target < 0 || target >= sections.length) return sections;
  const next = [...sections];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function duplicateSection(sections: BuilderSection[], sectionId: string): BuilderSection[] {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return sections;
  const source = sections[index];
  const clone: BuilderSection = {
    ...JSON.parse(JSON.stringify(source)) as BuilderSection,
    id: `${source.type}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const next = [...sections];
  next.splice(index + 1, 0, clone);
  return next;
}

export function removeSection(sections: BuilderSection[], sectionId: string): BuilderSection[] {
  const list = Array.isArray(sections) ? sections : Object.values((sections as unknown as Record<string, BuilderSection>) ?? {});
  return list.filter((section) => section.id !== sectionId);
}

export function updateSection(
  sections: BuilderSection[],
  sectionId: string,
  updater: (section: BuilderSection) => BuilderSection,
): BuilderSection[] {
  return sections.map((section) => (section.id === sectionId ? updater(section) : section));
}

export function hasUnsavedChanges(current: BuilderPageContent, saved: BuilderPageContent): boolean {
  return JSON.stringify(current) !== JSON.stringify(saved);
}

export function getCanvasClass(viewport: PreviewViewport): string {
  if (viewport === "mobile") return "max-w-[390px]";
  if (viewport === "tablet") return "max-w-[820px]";
  return "max-w-[1200px]";
}

export function groupForSectionType(type: BuilderSectionType): "Hero" | "Products" | "Content" | "Trust/Benefits" | "Promotions" | "Forms" | "Social" {
  if (type === "hero_banner") return "Hero";
  if (type === "featured_products") return "Products";
  if (type === "image_text") return "Content";
  if (type === "benefit_icons") return "Trust/Benefits";
  if (type === "contact_form" || type === "newsletter_signup") return "Forms";
  if (type === "social_links" || type === "whatsapp_cta") return "Social";
  if (type === "promo_banner" || type === "countdown_banner" || type === "announcement_bar") return "Promotions";
  return "Content";
}
