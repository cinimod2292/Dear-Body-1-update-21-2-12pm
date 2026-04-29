import { isOptimizedVariantUrl } from "../../builder/media-url";
import { findVariantByKey, normalizeVariants } from "./media-variants";

type AssetLike = { variants?: unknown };

const PREFERRED_HERO_VARIANT_KEYS = ["hero_desktop", "hero_desktop_2x", "heroDesktop", "lightbox", "gallery_main_2x", "gallery_main", "gallery", "card_2x", "card", "thumbnail", "thumb"];

function readVariantUrl(variant: any): string {
  return String(variant?.publicUrl ?? variant?.url ?? "").trim();
}

export function chooseOptimizedHeroUrl(asset: AssetLike): string | null {
  const variants = normalizeVariants(asset.variants);
  const debugKeys = ["thumbnail", "card", "gallery", "heroDesktop", "heroMobile", "original"] as const;
  for (const dbgKey of debugKeys) {
    const dbgVariant = findVariantByKey(variants, [dbgKey, dbgKey.toLowerCase(), dbgKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)]);
    console.info("[hero-media] variant-url", { key: dbgKey, url: readVariantUrl(dbgVariant), publicUrl: String((dbgVariant as any)?.publicUrl ?? ""), rawUrl: String((dbgVariant as any)?.url ?? "") });
  }
  for (const key of PREFERRED_HERO_VARIANT_KEYS) {
    const variant = findVariantByKey(variants, [key]);
    const url = readVariantUrl(variant);
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
