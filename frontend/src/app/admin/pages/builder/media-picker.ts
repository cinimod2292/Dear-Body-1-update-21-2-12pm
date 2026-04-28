import { MediaAsset } from "../../types/admin";
import { isSafeImageUrl } from "../../../builder/media-url";
import { BuilderSectionType } from "../../../builder/types";

function pickVariantUrl(asset: Pick<MediaAsset, "variants"> | null | undefined, preferredKeys: string[]) {
  const variants = asset?.variants;
  if (!variants) return null;

  if (!Array.isArray(variants)) {
    for (const key of preferredKeys) {
      const record = variants[key as keyof typeof variants] as any;
      const candidate = String(record?.url ?? record?.publicUrl ?? "").trim();
      if (candidate && isSafeImageUrl(candidate, { isHero: preferredKeys.includes("heroDesktop") })) return candidate;
    }
  }

  const list = Array.isArray(variants) ? variants : [];
  const keyAliases: Record<string, string[]> = {
    thumbnail: ["thumbnail", "thumb", "gallery_thumb"],
    gallery: ["gallery", "gallery_main"],
    heroDesktop: ["heroDesktop", "hero_desktop", "card"],
    heroMobile: ["heroMobile", "hero_mobile", "card"],
  };

  for (const key of preferredKeys) {
    const aliases = keyAliases[key] ?? [key];
    for (const alias of aliases) {
      const candidate = String(list.find((variant) => variant.key === alias)?.publicUrl ?? "").trim();
      if (candidate && isSafeImageUrl(candidate, { isHero: preferredKeys.includes("heroDesktop") })) return candidate;
    }
  }
  return null;
}

export function mediaAssetToImageUrl(asset: Pick<MediaAsset, "publicUrl" | "originalUrl"> | null | undefined) {
  const candidate = String(asset?.originalUrl ?? asset?.publicUrl ?? "").trim();
  if (!candidate) return null;
  return isSafeImageUrl(candidate) ? candidate : null;
}

export function resolveNextImageValue(currentValue: string, nextCandidate: string) {
  const candidate = nextCandidate.trim();
  if (!candidate) return "";
  if (!isSafeImageUrl(candidate)) return currentValue;
  return candidate;
}

export function mapSelectedMediaToFieldValue(currentValue: string, asset: Pick<MediaAsset, "publicUrl" | "originalUrl"> | null | undefined) {
  const url = mediaAssetToImageUrl(asset);
  if (!url) return currentValue;
  return url;
}

export function mapSelectedMediaVariantToFieldValue(
  currentValue: string,
  asset: Pick<MediaAsset, "publicUrl" | "variants" | "originalUrl"> | null | undefined,
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
  asset: Pick<MediaAsset, "publicUrl" | "variants" | "originalUrl"> | null | undefined,
  preferredKeys: string[],
) {
  const variantUrl = pickVariantUrl(asset, preferredKeys);
  if (!variantUrl) {
    return {
      shouldUpdate: false,
      nextValue: currentValue,
      warning: "This image has no Cloudflare delivery variant available yet.",
    } as const;
  }
  const next = mapSelectedMediaVariantToFieldValue(currentValue, asset, preferredKeys, { allowOriginalFallback: false });
  const trimmed = next.trim();
  if (!trimmed) {
    return {
      shouldUpdate: false,
      nextValue: currentValue,
      warning: "This image has no Cloudflare delivery variant available yet.",
    } as const;
  }
  return {
    shouldUpdate: true,
    nextValue: next,
    warning: null,
  } as const;
}
