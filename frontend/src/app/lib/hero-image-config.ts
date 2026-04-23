export function resolveHeroImageConfig(content: Record<string, unknown>, defaults: { pngFallbackUrl: string; optimizedFallbackUrl: string }) {
  const cmsBackgroundImage = content.backgroundImageUrl ? String(content.backgroundImageUrl) : "";
  if (cmsBackgroundImage) {
    return {
      useCmsImage: true,
      imageUrl: cmsBackgroundImage,
      optimizedFallbackUrl: "",
      pngFallbackUrl: "",
    } as const;
  }
  return {
    useCmsImage: false,
    imageUrl: defaults.pngFallbackUrl,
    optimizedFallbackUrl: defaults.optimizedFallbackUrl,
    pngFallbackUrl: defaults.pngFallbackUrl,
  } as const;
}
