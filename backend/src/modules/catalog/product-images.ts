import { AppError } from "../../lib/errors.js";

type GalleryImageInput = { mediaAssetId: string; position: number; altText?: string };

type ExistingGalleryImageInput = { mediaAssetId: string };

export function normalizeHoverImageId(params: {
  hoverImageId?: string | null;
  incomingGallery?: GalleryImageInput[];
  existingGallery?: ExistingGalleryImageInput[];
  existingHoverImageId?: string | null;
}): string | null | undefined {
  const { hoverImageId, incomingGallery, existingGallery, existingHoverImageId } = params;

  if (hoverImageId === undefined) {
    if (!incomingGallery) return undefined;
    if (!existingGallery) return undefined;

    if (!existingHoverImageId) return undefined;
    const currentGalleryIds = new Set(incomingGallery.map((image) => image.mediaAssetId));
    return currentGalleryIds.has(existingHoverImageId) ? undefined : null;
  }

  if (hoverImageId === null) return null;

  const galleryIds = new Set(
    (incomingGallery ?? existingGallery ?? []).map((image) => image.mediaAssetId),
  );

  if (!galleryIds.has(hoverImageId)) {
    throw new AppError(400, "Hover image must be one of the product gallery images", "PRODUCT_HOVER_IMAGE_INVALID");
  }

  return hoverImageId;
}

type Media = {
  id: string;
  filename: string;
  mimeType: string;
  storageKey?: string;
  publicUrl?: string | null;
};

export function withResolvedProductMediaUrls<T extends {
  galleries?: Array<{ mediaAsset?: Media | null }>;
  hoverImage?: Media | null;
}>(
  product: T,
  publicUrlForStorageKey: (storageKey: string) => string,
): T {
  const resolveMedia = (media?: Media | null) => {
    if (!media?.storageKey) return media;
    return { ...media, publicUrl: publicUrlForStorageKey(media.storageKey) };
  };

  return {
    ...product,
    galleries: Array.isArray(product.galleries)
      ? product.galleries.map((gallery) => ({
          ...gallery,
          mediaAsset: resolveMedia(gallery.mediaAsset),
        }))
      : product.galleries,
    hoverImage: resolveMedia(product.hoverImage),
  };
}
