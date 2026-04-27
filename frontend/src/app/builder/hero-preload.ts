import { BuilderPageContent } from "./types";
import { sanitizeBuilderImageUrl } from "./media-url";

export function getBuilderHeroImageUrl(content: BuilderPageContent | null): string | null {
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  const hero = sections.find((section) => section.type === "hero_banner" && section.enabled !== false);
  const url = String(hero?.props?.imageUrl ?? "").trim();
  if (!url) return null;
  return sanitizeBuilderImageUrl(url, { isHero: true });
}

export function heroPreloadDescriptor(url: string) {
  return {
    rel: "preload",
    as: "image",
    href: url,
    imagesizes: "100vw",
  } as const;
}
