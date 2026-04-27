import { MediaAsset } from "../../types/admin";
import { isSafeImageUrl } from "../../../builder/media-url";
import { BuilderSectionType } from "../../../builder/types";

function pickVariantUrl(asset: Pick<MediaAsset, "variants"> | null | undefined, preferredKeys: string[]) {
  const variants = Array.isArray(asset?.variants) ? asset?.variants : [];
  for (const key of preferredKeys) {
    const candidate = String(variants.find((variant) => variant.key === key)?.publicUrl ?? "").trim();
    if (candidate && isSafeImageUrl(candidate)) return candidate;
  }
  return null;
}

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

export function mapSelectedMediaVariantToFieldValue(
  currentValue: string,
  asset: Pick<MediaAsset, "publicUrl" | "variants"> | null | undefined,
  preferredKeys: string[],
  options?: { allowOriginalFallback?: boolean },
) {
  const variantUrl = pickVariantUrl(asset, preferredKeys);
  if (variantUrl) return variantUrl;
  if (options?.allowOriginalFallback === false) return currentValue;
  return mapSelectedMediaToFieldValue(currentValue, asset);
}

export function isHeroImageField(sectionType: BuilderSectionType, keyName: string) {
  return sectionType === "hero_banner" || keyName.toLowerCase().includes("hero");
}

export function resolveHeroImageSelection(
  currentValue: string,
  asset: Pick<MediaAsset, "publicUrl" | "variants"> | null | undefined,
  preferredKeys: string[],
) {
  const variantUrl = pickVariantUrl(asset, preferredKeys);
  if (!variantUrl) {
    return {
      shouldUpdate: false,
      nextValue: currentValue,
      warning: "This image has not finished optimizing yet. Run media backfill or try again in a moment.",
    } as const;
  }
  const next = mapSelectedMediaVariantToFieldValue(currentValue, asset, preferredKeys, { allowOriginalFallback: false });
  const trimmed = next.trim();
  if (!trimmed) {
    return {
      shouldUpdate: false,
      nextValue: currentValue,
      warning: "This image has not finished optimizing yet. Run media backfill or try again in a moment.",
    } as const;
  }
  return {
    shouldUpdate: true,
    nextValue: next,
    warning: null,
  } as const;
}
