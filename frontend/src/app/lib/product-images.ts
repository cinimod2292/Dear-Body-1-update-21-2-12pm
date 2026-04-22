export type ProductGalleryImage = {
  mediaAssetId: string;
  url: string;
  width?: number;
  height?: number;
};

export function normalizeProductImages(
  galleries: Array<{
    mediaAssetId?: string;
    mediaAsset?: { publicUrl?: string | null; metadata?: Record<string, unknown> | null } | null;
  }> | undefined,
): ProductGalleryImage[] {
  if (!Array.isArray(galleries)) return [];

  const parsePositiveNumber = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return undefined;
  };

  return galleries
    .map((gallery) => ({
      mediaAssetId: gallery.mediaAssetId ?? "",
      url: gallery.mediaAsset?.publicUrl?.trim() ?? "",
      width: parsePositiveNumber(gallery.mediaAsset?.metadata?.width),
      height: parsePositiveNumber(gallery.mediaAsset?.metadata?.height),
    }))
    .filter((entry) => entry.mediaAssetId && entry.url);
}

export function resolveHoverImageUrl(params: {
  primaryImageUrl: string;
  hoverImageId?: string | null;
  galleryImages: ProductGalleryImage[];
}): string | undefined {
  const { primaryImageUrl, hoverImageId, galleryImages } = params;
  if (!hoverImageId) return undefined;

  const hoverImage = galleryImages.find((image) => image.mediaAssetId === hoverImageId);
  if (!hoverImage?.url || hoverImage.url === primaryImageUrl) return undefined;
  return hoverImage.url;
}
