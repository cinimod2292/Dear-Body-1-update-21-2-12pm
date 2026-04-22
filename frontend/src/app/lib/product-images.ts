export type ProductGalleryImage = {
  mediaAssetId: string;
  url: string;
  width?: number;
  height?: number;
  variants: Record<string, { url: string; width?: number; height?: number }>;
};

export function normalizeProductImages(
  galleries: Array<{
    mediaAssetId?: string;
    mediaAsset?: {
      publicUrl?: string | null;
      metadata?: Record<string, unknown> | null;
      variants?: Array<{ key: string; publicUrl?: string | null; width?: number; height?: number }> | null;
    } | null;
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
      variants: Object.fromEntries(
        (gallery.mediaAsset?.variants ?? [])
          .filter((variant) => variant?.key && variant.publicUrl)
          .map((variant) => [
            variant.key,
            {
              url: String(variant.publicUrl),
              width: parsePositiveNumber(variant.width),
              height: parsePositiveNumber(variant.height),
            },
          ]),
      ),
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
  if (!hoverImage?.url) return undefined;
  const hoverUrl = hoverImage.variants.card?.url ?? hoverImage.url;
  if (hoverUrl === primaryImageUrl) return undefined;
  return hoverUrl;
}


export function resolveCardImage(entry: ProductGalleryImage | undefined): { image: string; image2x?: string } {
  if (!entry) return { image: "" };
  return {
    image: entry.variants.card?.url ?? entry.url,
    image2x: entry.variants.card_2x?.url,
  };
}

export function mapGallerySurfaceImages(entry: ProductGalleryImage): {
  url: string;
  width?: number;
  height?: number;
  thumbUrl: string;
  mainUrl: string;
  main2xUrl?: string;
  lightboxUrl: string;
  lightbox2xUrl?: string;
} {
  return {
    url: entry.url,
    width: entry.width,
    height: entry.height,
    thumbUrl: entry.variants.gallery_thumb?.url ?? entry.variants.thumb?.url ?? entry.url,
    mainUrl: entry.variants.gallery_main?.url ?? entry.variants.card?.url ?? entry.url,
    main2xUrl: entry.variants.gallery_main_2x?.url,
    lightboxUrl: entry.variants.lightbox?.url ?? entry.variants.gallery_main_2x?.url ?? entry.url,
    lightbox2xUrl: entry.variants.lightbox_2x?.url,
  };
}
