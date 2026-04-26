import { sanitizeBuilderImageUrl } from "../builder/media-url";

export function resolveHeroImageConfig(content: Record<string, unknown>) {
  const cmsBackgroundImage = content.backgroundImageUrl ? String(content.backgroundImageUrl) : "";
  const imageUrl = sanitizeBuilderImageUrl(cmsBackgroundImage, { isHero: true });
  return {
    imageUrl,
  } as const;
}
