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


function isRawOriginalUrl(url: string) {
  const v = url.trim().toLowerCase();
  return Boolean(v) && v.includes('/uploads/') && !isOptimizedVariantUrl(v);
}

function resizeUrlFromOriginal(original: string, width: number) {
  const src = original.trim();
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return `${new URL(src).origin}/cdn-cgi/image/width=${width},fit=cover,format=auto,quality=85/${src}`;
  const normalized = src.startsWith('/') ? src : `/${src}`;
  return `/cdn-cgi/image/width=${width},fit=cover,format=auto,quality=85${normalized}`;
}

export function synthesizeOptimizedHeroVariants<T extends { variants?: unknown; originalUrl?: string | null; publicUrl?: string | null; storageKey?: string | null }>(asset: T): T {
  const variants = normalizeVariants(asset.variants);
  const source = String(asset.originalUrl ?? asset.publicUrl ?? '').trim();
  if (!source) return asset;
  const map = new Map(variants.map((v) => [String((v as any).key ?? '').toLowerCase(), v as any]));
  map.set('original', { key: 'original', url: source });
  const ensure = (keys: string[], width: number, fit: "cover" | "contain" = "cover") => {
    const generated = resizeUrlFromOriginal(source, width).replace("fit=cover", `fit=${fit}`);
    let foundOptimized = false;
    for (const key of keys) {
      const current = map.get(key.toLowerCase());
      const currentUrl = readVariantUrl(current);
      if (isOptimizedVariantUrl(currentUrl)) {
        foundOptimized = true;
        map.set(key.toLowerCase(), { key, url: currentUrl });
      }
    }
    if (!foundOptimized) {
      for (const key of keys) {
        map.set(key.toLowerCase(), { key, url: generated });
      }
      return;
    }
    for (const key of keys) {
      const current = map.get(key.toLowerCase());
      const currentUrl = readVariantUrl(current);
      if (!currentUrl || isRawOriginalUrl(currentUrl)) {
        map.set(key.toLowerCase(), { key, url: generated });
      }
    }
  };
  ensure(['heroDesktop','hero_desktop'], 1920, 'cover');
  ensure(['heroMobile','hero_mobile'], 768, 'cover');
  ensure(['card','card_2x'], 600, 'cover');
  ensure(['thumbnail','thumb','gallery_thumb'], 300, 'cover');
  ensure(['gallery','gallery_main'], 1200, 'contain');
  const variantObject = Object.fromEntries(Array.from(map.values()).map((entry: any) => [String(entry?.key ?? ''), { url: readVariantUrl(entry) }]));
  return { ...asset, variants: variantObject };
}
