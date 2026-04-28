import { toMediaAssetContract } from "./media-contract.js";
import { type UploadConfig } from "./upload.service.js";

type VariantLike = { key: string; storageKey?: string | null; publicUrl?: string | null; width?: number | null; height?: number | null; mimeType?: string | null };
type MediaLike = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "FILE";
  filename: string;
  altText?: string | null;
  createdAt: Date;
  storageKey: string;
  publicUrl?: string | null;
  mimeType?: string | null;
  metadata?: unknown;
  variants?: VariantLike[];
};

export function toPickerMediaItem(asset: MediaLike, cfg: UploadConfig) {
  const contract = toMediaAssetContract(asset, cfg);
  return {
    id: asset.id,
    kind: asset.kind,
    filename: asset.filename,
    altText: asset.altText ?? null,
    createdAt: asset.createdAt,
    thumbnailUrl: contract.variants.thumbnail.url,
    displayUrl: contract.originalUrl,
    storageProvider: contract.storageProvider,
    variants: contract.variants,
  };
}
