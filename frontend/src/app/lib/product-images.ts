export type ProductGalleryImage = {
  mediaAssetId: string;
  url: string;
  width?: number;
  height?: number;
  variants: Record<string, { url: string; width?: number; height?: number }>;
};

type SurfaceImage = {
  url: string;
  width?: number;
  height?: number;
  variants?: Record<string, { url: string; width?: number; height?: number }>;
};

export type ImageSourceSet = {
  src: string;
  srcSet?: string;
  width?: number;
  height?: number;
};

export type ProductCardImageFields = {
  image: string;
  image2x?: string;
  imageWidth?: number;
  imageHeight?: number;
  hoverImage?: string;
  hoverImage2x?: string;
  hoverImageWidth?: number;
  hoverImageHeight?: number;
};

export const PRODUCT_CARD_IMAGE_SIZES = "(min-width: 1280px) 280px, (min-width: 1024px) 29vw, (min-width: 640px) 44vw, 92vw";


function normalizeList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>) as T[];
  return [];
}

export function extract2xUrl(srcSet?: string): string | undefined {
  if (!srcSet) return undefined;
  const second = srcSet.split(",")[1]?.trim();
  if (!second) return undefined;
  return second.split(" ")[0];
}

export function normalizeProductImages(
  galleries: Array<{
    mediaAssetId?: string;
    mediaAsset?: {
      publicUrl?: string | null;
      metadata?: Record<string, unknown> | null;
      variants?: Array<{ key: string; publicUrl?: string | null; width?: number; height?: number }> | Record<string, { url?: string | null; publicUrl?: string | null; width?: number; height?: number }> | null;
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
      variants: (() => {
        const rawVariants = gallery.mediaAsset?.variants;
        console.info("[product-mapper] gallery.mediaAsset.variants", {
          mediaAssetId: gallery.mediaAssetId ?? null,
          valueType: typeof rawVariants,
          isArray: Array.isArray(rawVariants),
          keys: Object.keys((rawVariants ?? {}) as Record<string, unknown>),
        });
        const variantList = Array.isArray(rawVariants)
          ? rawVariants.map((variant) => ({
            key: String((variant as any)?.key ?? ""),
            publicUrl: (variant as any)?.publicUrl ?? (variant as any)?.url,
            width: (variant as any)?.width,
            height: (variant as any)?.height,
          }))
          : Object.entries((rawVariants ?? {}) as Record<string, unknown>).map(([key, variant]) => ({
            key,
            publicUrl: (variant as any)?.publicUrl ?? (variant as any)?.url,
            width: (variant as any)?.width,
            height: (variant as any)?.height,
          }));
        return Object.fromEntries(
          variantList
            .filter((variant) => variant?.key && variant.publicUrl)
            .map((variant) => [
              variant.key,
              {
                url: String(variant.publicUrl),
                width: parsePositiveNumber(variant.width),
                height: parsePositiveNumber(variant.height),
              },
            ]),
        );
      })(),
    }))
    .filter((entry) => entry.mediaAssetId && entry.url);
}

export function resolveHoverImageUrl(params: {
  primaryImageUrl: string;
  hoverImageId?: string | null;
  galleryImages: ProductGalleryImage[];
}): string | undefined {
  const { primaryImageUrl, hoverImageId, galleryImages } = params;
  const hoverImage = hoverImageId
    ? galleryImages.find((image) => image.mediaAssetId === hoverImageId)
    : galleryImages[1];
  if (!hoverImage?.url) return undefined;
  const hoverUrl = getCardImageSources(hoverImage)?.src ?? hoverImage.url;
  if (hoverUrl === primaryImageUrl) return undefined;
  return hoverUrl;
}

export function resolveCardImage(entry: ProductGalleryImage | undefined): { image: string; image2x?: string } {
  const card = getCardImageSources(entry);
  if (!card) return { image: "" };
  return {
    image: card.src,
    image2x: extract2xUrl(card.srcSet),
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
  const thumb = getThumbImageSources(entry);
  const main = getGalleryMainSources(entry);
  const lightbox = getLightboxSources(entry);
  return {
    url: entry.url,
    width: entry.width,
    height: entry.height,
    thumbUrl: thumb?.src ?? entry.url,
    mainUrl: main?.src ?? entry.url,
    main2xUrl: extract2xUrl(main?.srcSet),
    lightboxUrl: lightbox?.src ?? entry.url,
    lightbox2xUrl: extract2xUrl(lightbox?.srcSet),
  };
}

export function getCardImageSources(entry: SurfaceImage | undefined): ImageSourceSet | undefined {
  if (!entry?.url) return undefined;
  const src = entry.variants?.card?.url
    ?? entry.variants?.gallery_main?.url
    ?? entry.variants?.thumb?.url
    ?? entry.url;
  const src2x = entry.variants?.card_2x?.url;
  return {
    src,
    srcSet: src2x ? `${src} 1x, ${src2x} 2x` : undefined,
    width: entry.variants?.card?.width ?? entry.variants?.gallery_main?.width ?? entry.variants?.thumb?.width ?? entry.width,
    height: entry.variants?.card?.height ?? entry.variants?.gallery_main?.height ?? entry.variants?.thumb?.height ?? entry.height,
  };
}

export function getThumbImageSources(entry: SurfaceImage | undefined): ImageSourceSet | undefined {
  if (!entry?.url) return undefined;
  return {
    src: entry.variants?.gallery_thumb?.url ?? entry.variants?.thumb?.url ?? entry.url,
    width: entry.variants?.gallery_thumb?.width ?? entry.variants?.thumb?.width ?? entry.width,
    height: entry.variants?.gallery_thumb?.height ?? entry.variants?.thumb?.height ?? entry.height,
  };
}

export function getGalleryMainSources(entry: SurfaceImage | undefined): ImageSourceSet | undefined {
  if (!entry?.url) return undefined;
  const src = entry.variants?.gallery_main?.url ?? entry.variants?.card?.url ?? entry.url;
  const src2x = entry.variants?.gallery_main_2x?.url;
  return {
    src,
    srcSet: src2x ? `${src} 1x, ${src2x} 2x` : undefined,
    width: entry.variants?.gallery_main?.width ?? entry.variants?.card?.width ?? entry.width,
    height: entry.variants?.gallery_main?.height ?? entry.variants?.card?.height ?? entry.height,
  };
}

export function getLightboxSources(entry: SurfaceImage | undefined): ImageSourceSet | undefined {
  if (!entry?.url) return undefined;
  const src = entry.variants?.lightbox?.url ?? entry.variants?.gallery_main_2x?.url ?? entry.variants?.gallery_main?.url ?? entry.url;
  const src2x = entry.variants?.lightbox_2x?.url;
  return {
    src,
    srcSet: src2x ? `${src} 1x, ${src2x} 2x` : undefined,
    width: entry.variants?.lightbox?.width ?? entry.variants?.gallery_main_2x?.width ?? entry.variants?.gallery_main?.width ?? entry.width,
    height: entry.variants?.lightbox?.height ?? entry.variants?.gallery_main_2x?.height ?? entry.variants?.gallery_main?.height ?? entry.height,
  };
}

export function mapProductCardImageFields(params: {
  primaryImage?: ProductGalleryImage;
  hoverImageId?: string | null;
  galleryImages: ProductGalleryImage[];
}): ProductCardImageFields {
  const { primaryImage, hoverImageId, galleryImages } = params;
  const fallbackImage = primaryImage?.url ?? "";
  const primaryCardSources = getCardImageSources(primaryImage);
  const hoverImageMeta = hoverImageId
    ? galleryImages.find((entry) => entry.mediaAssetId === hoverImageId)
    : galleryImages[1];
  const hoverCardSources = getCardImageSources(hoverImageMeta);
  const hoverImage = resolveHoverImageUrl({
    primaryImageUrl: primaryCardSources?.src ?? fallbackImage,
    hoverImageId,
    galleryImages,
  });

  return {
    image: primaryCardSources?.src ?? fallbackImage,
    image2x: extract2xUrl(primaryCardSources?.srcSet),
    imageWidth: primaryCardSources?.width ?? primaryImage?.width,
    imageHeight: primaryCardSources?.height ?? primaryImage?.height,
    hoverImage,
    hoverImage2x: extract2xUrl(hoverCardSources?.srcSet),
    hoverImageWidth: hoverCardSources?.width ?? hoverImageMeta?.width,
    hoverImageHeight: hoverCardSources?.height ?? hoverImageMeta?.height,
  };
}
