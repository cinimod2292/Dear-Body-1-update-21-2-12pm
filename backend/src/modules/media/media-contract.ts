import { isRemoteImportStorageKey, resolvePublicUrlForStorageKey, type UploadConfig } from "./upload.service.js";

export type MediaVariantContractItem = {
  url: string;
  width?: number;
  height?: number;
  format?: string;
};

export type MediaContractVariants = {
  thumbnail: MediaVariantContractItem;
  card: MediaVariantContractItem;
  gallery: MediaVariantContractItem;
  heroDesktop: MediaVariantContractItem;
  heroMobile: MediaVariantContractItem;
  original: { url: string; format?: string };
};

const CLOUD_FLARE_SPECS = {
  thumbnail: { width: 300, height: 300, fit: "cover" },
  card: { width: 600, height: 600, fit: "cover" },
  gallery: { width: 1200, height: 1200, fit: "contain" },
  heroDesktop: { width: 1920, height: 1080, fit: "cover" },
  heroMobile: { width: 768, height: 1024, fit: "cover" },
} as const;

const LEGACY_KEYS: Record<keyof typeof CLOUD_FLARE_SPECS, string[]> = {
  thumbnail: ["thumb", "thumbnail", "gallery_thumb"],
  card: ["card", "card_2x"],
  gallery: ["gallery_main", "gallery_thumb", "lightbox"],
  heroDesktop: ["hero_desktop", "card", "gallery_main"],
  heroMobile: ["hero_mobile", "card", "gallery_main"],
};

type VariantRow = { key: string; storageKey?: string | null; publicUrl?: string | null; width?: number | null; height?: number | null; mimeType?: string | null };

type MediaLike = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "FILE";
  mimeType?: string | null;
  storageKey: string;
  publicUrl?: string | null;
  metadata?: unknown;
  variants?: VariantRow[];
};

function extensionFromMime(mimeType: string | null | undefined) {
  if (!mimeType) return undefined;
  return mimeType.split("/")[1] ?? undefined;
}

function inferStorageProvider(asset: MediaLike, cfg: UploadConfig): "local" | "s3" | "cloudflare-r2" | "legacy-local" {
  const metadataProvider = typeof (asset.metadata as any)?.storageProvider === "string" ? (asset.metadata as any).storageProvider : null;
  if (metadataProvider === "local" || metadataProvider === "s3" || metadataProvider === "cloudflare-r2") return metadataProvider;
  if (asset.storageKey.startsWith("uploads/") && cfg.provider !== "local") return "legacy-local";
  return cfg.provider;
}

function resolveOriginalUrl(asset: MediaLike, cfg: UploadConfig) {
  // Remote-import assets aren't in our bucket; their bytes live at the stored
  // external publicUrl. Resolving from the synthetic storageKey would yield a
  // /media/public/remote-import/... redirect that 404s (and trips ORB on <img>).
  if (isRemoteImportStorageKey(asset.storageKey) && asset.publicUrl) {
    return String(asset.publicUrl);
  }
  return resolvePublicUrlForStorageKey(asset.storageKey, cfg);
}

function resolveCloudflareResizedUrl(originalUrl: string, key: keyof typeof CLOUD_FLARE_SPECS, cfg: UploadConfig) {
  const base = String(cfg.publicBaseUrl ?? "").replace(/\/+$/, "");
  const spec = CLOUD_FLARE_SPECS[key];
  const trimmed = String(originalUrl).trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    let deliveryBase = base;
    try { deliveryBase = new URL(trimmed).origin; } catch {}
    return `${deliveryBase}/cdn-cgi/image/width=${spec.width},height=${spec.height},fit=${spec.fit},format=auto,quality=85/${trimmed}`;
  }
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `/cdn-cgi/image/width=${spec.width},height=${spec.height},fit=${spec.fit},format=auto,quality=85${normalizedPath}`;
}

function pickLegacyVariant(variants: VariantRow[], keys: string[]) {
  for (const key of keys) {
    const match = variants.find((variant) => variant.key === key);
    if (match) return match;
  }
  return null;
}


function isOptimizedUrl(url: string | null | undefined) {
  const v = String(url ?? "").trim().toLowerCase();
  if (!v) return false;
  return v.includes("/cdn-cgi/image/") || v.includes("/variants/") || v.includes("imagedelivery.net") || v.endsWith(".webp");
}

function toVariantUrl(variant: VariantRow | null, cfg: UploadConfig) {
  if (!variant) return null;
  if (variant.storageKey) return resolvePublicUrlForStorageKey(variant.storageKey, cfg);
  return variant.publicUrl ? String(variant.publicUrl) : null;
}

export function toMediaAssetContract(asset: MediaLike, cfg: UploadConfig) {
  const storageProvider = inferStorageProvider(asset, cfg);
  const originalUrl = resolveOriginalUrl(asset, cfg);
  const variants = Array.isArray(asset.variants) ? asset.variants : [];
  const remoteImport = isRemoteImportStorageKey(asset.storageKey);

  // Remote-import assets have no generated variants and live on an external host,
  // so CDN resize wrapping (/cdn-cgi/image/...) won't apply — serve the original.
  // Cloudflare image resizing (/cdn-cgi/image/...) only works when the request is
  // served through a transform-capable public delivery domain. Without one, those
  // URLs resolve against the API host (which has no /cdn-cgi/image) and 404 — so
  // only generate delivery variants when a public delivery base URL is configured.
  const hasDeliveryDomain = Boolean(String(cfg.publicBaseUrl ?? "").trim());
  const shouldGenerateDeliveryVariants = !remoteImport && hasDeliveryDomain;
  const v = (key: keyof typeof CLOUD_FLARE_SPECS): MediaVariantContractItem => {
    const spec = CLOUD_FLARE_SPECS[key];
    if (remoteImport) {
      return { url: originalUrl, width: spec.width, height: spec.height, format: "auto" };
    }
    const legacyVariant = pickLegacyVariant(variants, LEGACY_KEYS[key]);
    const legacyUrl = toVariantUrl(legacyVariant, cfg);
    // With a delivery domain: emit a resized /cdn-cgi/image URL. Without one: prefer a
    // pre-generated variant object if we have one, otherwise serve the original (both
    // load reliably through /media/public/*) rather than a broken /cdn-cgi URL.
    const url = shouldGenerateDeliveryVariants
      ? resolveCloudflareResizedUrl(originalUrl, key, cfg)
      : (isOptimizedUrl(legacyUrl) ? String(legacyUrl) : originalUrl);
    return {
      url,
      width: legacyVariant?.width ?? spec.width,
      height: legacyVariant?.height ?? spec.height,
      format: extensionFromMime(legacyVariant?.mimeType) ?? "auto",
    };
  };

  return {
    ...asset,
    storageProvider,
    originalUrl,
    publicUrl: originalUrl,
    variants: {
      thumbnail: v("thumbnail"),
      card: v("card"),
      gallery: v("gallery"),
      heroDesktop: v("heroDesktop"),
      heroMobile: v("heroMobile"),
      original: { url: originalUrl, format: extensionFromMime(asset.mimeType) ?? "auto" },
    } as MediaContractVariants,
  };
}
