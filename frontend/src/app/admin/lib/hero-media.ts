import { isOptimizedVariantUrl } from "../../builder/media-url";

type VariantLike = { key?: string | null; publicUrl?: string | null; url?: string | null };
type AssetLike = { variants?: VariantLike[] | Record<string, VariantLike | string | null | undefined> | null };

const PREFERRED_HERO_VARIANT_KEYS = ["hero_desktop", "hero_desktop_2x", "lightbox", "gallery_main_2x", "gallery_main", "card_2x", "card", "thumb"];

function toVariantArray(variants: AssetLike["variants"]): VariantLike[] {
  if (Array.isArray(variants)) return variants;
  if (!variants || typeof variants !== "object") return [];
  return Object.entries(variants).map(([key, value]) => {
    if (typeof value === "string") return { key, publicUrl: value };
    if (!value || typeof value !== "object") return { key };
    return { key, ...value };
  });
}

function readVariantUrl(variant: VariantLike): string {
  return String(variant.publicUrl ?? variant.url ?? "").trim();
}

export function chooseOptimizedHeroUrl(asset: AssetLike): string | null {
  const variants = toVariantArray(asset.variants);
  for (const key of PREFERRED_HERO_VARIANT_KEYS) {
    const variant = variants.find((entry) => String(entry?.key ?? "") === key);
    const url = variant ? readVariantUrl(variant) : "";
    if (url && isOptimizedVariantUrl(url)) return url;
  }
  return null;
}

export function requireOptimizedHeroUrl(asset: AssetLike): string {
  const chosen = chooseOptimizedHeroUrl(asset);
  if (!chosen) {
    throw new Error("No optimized variant URL found for this media asset. Generate variants first, then assign hero.");
  }
  return chosen;
}
