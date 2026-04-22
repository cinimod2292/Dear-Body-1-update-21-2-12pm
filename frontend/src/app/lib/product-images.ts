export type ProductGalleryImage = {
  mediaAssetId: string;
  url: string;
};

export function normalizeProductImages(
  galleries: Array<{ mediaAssetId?: string; mediaAsset?: { publicUrl?: string | null } | null }> | undefined,
): ProductGalleryImage[] {
  if (!Array.isArray(galleries)) return [];
  return galleries
    .map((gallery) => ({
      mediaAssetId: gallery.mediaAssetId ?? "",
      url: gallery.mediaAsset?.publicUrl?.trim() ?? "",
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
