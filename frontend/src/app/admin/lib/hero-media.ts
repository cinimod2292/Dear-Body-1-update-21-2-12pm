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

export function synthesizeOptimizedHeroVariants<T extends { variants?: unknown; originalUrl?: string | null; publicUrl?: string | null; mediaPublicUrl?: string | null; storageKey?: string | null }>(asset: T): T {
  const src = String(asset.originalUrl ?? (asset as any).mediaPublicUrl ?? asset.publicUrl ?? "").trim();
  if (!src) return asset;

  const origin = (() => {
    try {
      if (/^https?:\/\//i.test(src)) return new URL(src).origin;
      if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
      return "";
    } catch {
      return "";
    }
  })();

  const build = (params: string) => {
    if (/^https?:\/\//i.test(src)) {
      return `${origin}/cdn-cgi/image/${params}/${src}`;
    }
    const normalized = src.startsWith("/") ? src : `/${src}`;
    return `/cdn-cgi/image/${params}${normalized}`;
  };

  const heroDesktop = build("width=1920,height=1080,fit=cover,format=auto,quality=85");
  const heroMobile = build("width=768,fit=cover,format=auto,quality=85");
  const card = build("width=600,fit=cover,format=auto,quality=85");
  const thumbnail = build("width=300,fit=cover,format=auto,quality=85");
  const gallery = build("width=1200,fit=contain,format=auto,quality=85");

  return {
    ...asset,
    variants: {
      thumbnail: { url: thumbnail },
      card: { url: card },
      gallery: { url: gallery },
      heroDesktop: { url: heroDesktop },
      heroMobile: { url: heroMobile },
      original: { url: src },
    },
  };
}
