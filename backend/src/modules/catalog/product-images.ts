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
  variants?: Array<{ key?: string; storageKey?: string; publicUrl?: string | null; width?: number; height?: number; mimeType?: string }>;
};

// Mirrors REMOTE_IMPORT_STORAGE_PREFIX in the media module. Kept inline so this
// file stays free of the env-loading upload.service dependency.
const REMOTE_IMPORT_STORAGE_PREFIX = "remote-import/";

function isRemoteImportStorageKey(storageKey?: string | null): boolean {
  return typeof storageKey === "string" && storageKey.startsWith(REMOTE_IMPORT_STORAGE_PREFIX);
}

function variantObjectFromArray(media: Media, publicUrlForStorageKey: (storageKey: string) => string) {
  const byKey = new Map((media.variants ?? []).map((variant) => [String(variant.key ?? ""), variant]));
  const fromKey = (...keys: string[]) => {
    for (const key of keys) {
      const variant = byKey.get(key);
      if (!variant) continue;
      return {
        url: variant.storageKey ? publicUrlForStorageKey(variant.storageKey) : String(variant.publicUrl ?? ""),
        width: variant.width,
        height: variant.height,
        format: variant.mimeType?.split("/")[1] ?? "auto",
      };
    }
    return null;
  };

  const originalUrl = isRemoteImportStorageKey(media.storageKey) && media.publicUrl
    ? String(media.publicUrl)
    : media.storageKey ? publicUrlForStorageKey(media.storageKey) : String(media.publicUrl ?? "");
  return {
    thumbnail: fromKey("thumbnail", "thumb", "gallery_thumb") ?? { url: originalUrl },
    card: fromKey("card", "card_2x") ?? { url: originalUrl },
    gallery: fromKey("gallery", "gallery_main", "lightbox") ?? { url: originalUrl },
    heroDesktop: fromKey("heroDesktop", "hero_desktop", "card") ?? { url: originalUrl },
    heroMobile: fromKey("heroMobile", "hero_mobile", "card") ?? { url: originalUrl },
    original: { url: originalUrl, format: media.mimeType?.split("/")[1] ?? "auto" },
  };
}

export function withResolvedProductMediaUrls<T extends {
  galleries?: Array<{ mediaAsset?: Media | null }>;
  hoverImage?: Media | null;
}>(
  product: T,
  publicUrlForStorageKey: (storageKey: string) => string,
): T {
  const resolveMedia = (media?: Media | null) => {
    if (!media?.storageKey) return media;
    // Remote-import assets live at their stored external publicUrl, not in our
    // bucket, so don't rewrite their URL to a /media/public/remote-import/... key.
    const originalUrl = isRemoteImportStorageKey(media.storageKey) && media.publicUrl
      ? String(media.publicUrl)
      : publicUrlForStorageKey(media.storageKey);
    return {
      ...media,
      publicUrl: originalUrl,
      originalUrl,
      variants: variantObjectFromArray(media, publicUrlForStorageKey),
    };
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
