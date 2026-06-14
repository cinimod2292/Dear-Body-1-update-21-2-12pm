import { BuilderPageContent } from "./types";
import { sanitizeBuilderImageUrl } from "./media-url";

export function getBuilderHeroUrls(content: BuilderPageContent | null): { imageUrl: string | null; imageMobileUrl: string | null } {
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  const hero = sections.find((section) => section.type === "hero_banner" && section.enabled !== false);
  const imageUrl = sanitizeBuilderImageUrl(String(hero?.props?.imageUrl ?? "").trim(), { isHero: true });
  const imageMobileUrl = sanitizeBuilderImageUrl(String(hero?.props?.imageMobileUrl ?? "").trim(), { isHero: true });
  return { imageUrl, imageMobileUrl };
}

export function getBuilderHeroImageUrl(content: BuilderPageContent | null): string | null {
  return getBuilderHeroUrls(content).imageUrl;
}

export function heroPreloadDescriptor(url: string, mobileUrl?: string | null) {
  const hasMobile = mobileUrl && mobileUrl !== url;
  return {
    rel: "preload",
    as: "image",
    href: url,
    imagesizes: "100vw",
    ...(hasMobile ? { imagesrcset: `${mobileUrl} 768w, ${url} 1920w` } : {}),
  } as const;
}
