import { MediaAsset } from "../../types/admin";
import { isSafeImageUrl } from "../../../builder/media-url";

export function mediaAssetToImageUrl(asset: Pick<MediaAsset, "publicUrl"> | null | undefined) {
  const candidate = String(asset?.publicUrl ?? "").trim();
  if (!candidate) return null;
  return isSafeImageUrl(candidate) ? candidate : null;
}

export function resolveNextImageValue(currentValue: string, nextCandidate: string) {
  const candidate = nextCandidate.trim();
  if (!candidate) return "";
  if (!isSafeImageUrl(candidate)) return currentValue;
  return candidate;
}

export function mapSelectedMediaToFieldValue(currentValue: string, asset: Pick<MediaAsset, "publicUrl"> | null | undefined) {
  const url = mediaAssetToImageUrl(asset);
  if (!url) return currentValue;
  return url;
}
