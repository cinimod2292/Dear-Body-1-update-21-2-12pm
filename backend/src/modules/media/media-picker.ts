import { resolvePublicUrlForStorageKey, type UploadConfig } from "./upload.service.js";

type VariantLike = { key: string; storageKey?: string | null; publicUrl?: string | null };
type MediaLike = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "FILE";
  filename: string;
  altText?: string | null;
  createdAt: Date;
  storageKey: string;
  publicUrl?: string | null;
  variants?: VariantLike[];
};

export function resolvePickerThumbnailUrl(asset: MediaLike, cfg: UploadConfig): string {
  const variants = asset.variants ?? [];
  const preferred = variants.find((variant) => variant.key === "thumb")
    ?? variants.find((variant) => variant.key === "card")
    ?? variants.find((variant) => variant.key === "gallery_thumb")
    ?? variants[0];

  if (preferred?.storageKey) return resolvePublicUrlForStorageKey(preferred.storageKey, cfg);
  if (preferred?.publicUrl) return String(preferred.publicUrl);
  return resolvePublicUrlForStorageKey(asset.storageKey, cfg);
}

export function toPickerMediaItem(asset: MediaLike, cfg: UploadConfig) {
  return {
    id: asset.id,
    kind: asset.kind,
    filename: asset.filename,
    altText: asset.altText ?? null,
    createdAt: asset.createdAt,
    thumbnailUrl: resolvePickerThumbnailUrl(asset, cfg),
    displayUrl: resolvePublicUrlForStorageKey(asset.storageKey, cfg),
  };
}
