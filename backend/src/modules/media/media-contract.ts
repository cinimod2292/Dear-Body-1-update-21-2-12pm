import { resolvePublicUrlForStorageKey, type UploadConfig } from "./upload.service.js";

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
  thumbnail: { width: 160, height: 160, fit: "cover" },
  card: { width: 480, height: 480, fit: "cover" },
  gallery: { width: 960, height: 960, fit: "contain" },
  heroDesktop: { width: 1920, height: 1080, fit: "cover" },
  heroMobile: { width: 900, height: 1200, fit: "cover" },
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
  return resolvePublicUrlForStorageKey(asset.storageKey, cfg);
}

function resolveCloudflareResizedUrl(originalUrl: string, key: keyof typeof CLOUD_FLARE_SPECS, cfg: UploadConfig) {
  const base = String(cfg.publicBaseUrl ?? "").replace(/\/+$/, "");
  const spec = CLOUD_FLARE_SPECS[key];
  const source = /^https?:\/\//i.test(originalUrl) ? originalUrl : (base ? `${base}/${String(originalUrl).replace(/^\/+/, "")}` : originalUrl);
  if (!/^https?:\/\//i.test(source)) return source;
  const deliveryBase = (() => {
    try {
      return new URL(source).origin;
    } catch {
      return base;
    }
  })();
  return `${deliveryBase}/cdn-cgi/image/width=${spec.width},height=${spec.height},fit=${spec.fit},format=auto,quality=85/${source}`;
}

function pickLegacyVariant(variants: VariantRow[], keys: string[]) {
  for (const key of keys) {
    const match = variants.find((variant) => variant.key === key);
    if (match) return match;
  }
  return null;
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

  const cloudflareNative = storageProvider === "cloudflare-r2";
  const v = (key: keyof typeof CLOUD_FLARE_SPECS): MediaVariantContractItem => {
    const legacyVariant = pickLegacyVariant(variants, LEGACY_KEYS[key]);
    const legacyUrl = toVariantUrl(legacyVariant, cfg);
    const spec = CLOUD_FLARE_SPECS[key];
    const url = cloudflareNative ? resolveCloudflareResizedUrl(originalUrl, key, cfg) : (legacyUrl ?? resolveCloudflareResizedUrl(originalUrl, key, cfg));
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
