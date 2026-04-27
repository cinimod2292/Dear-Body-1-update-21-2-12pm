import { prisma } from "../../lib/prisma.js";
import { resolvePublicUrlForStorageKey, resolveUploadConfig, readStorageObjectBuffer, writeStorageObjectBuffer } from "./upload.service.js";

export const MEDIA_VARIANT_SPECS = [
  { key: "thumb", maxWidth: 160, maxHeight: 160 },
  { key: "card", maxWidth: 480, maxHeight: 480 },
  { key: "card_2x", maxWidth: 720, maxHeight: 720 },
  { key: "gallery_thumb", maxWidth: 200, maxHeight: 200 },
  { key: "gallery_main", maxWidth: 960, maxHeight: 960 },
  { key: "gallery_main_2x", maxWidth: 1440, maxHeight: 1440 },
  { key: "lightbox", maxWidth: 1600, maxHeight: 1600 },
  { key: "lightbox_2x", maxWidth: 2000, maxHeight: 2000 },
  { key: "hero_mobile", maxWidth: 900, maxHeight: 1200 },
  { key: "hero_desktop", maxWidth: 1920, maxHeight: 1080 },
  { key: "hero_desktop_2x", maxWidth: 2400, maxHeight: 1350 },
  { key: "logo_header", maxWidth: 220, maxHeight: 80 },
  { key: "logo_footer", maxWidth: 260, maxHeight: 100 },
  { key: "logo_2x", maxWidth: 520, maxHeight: 200 },
] as const;

type VariantKey = typeof MEDIA_VARIANT_SPECS[number]["key"];

type TransformOutput = {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
};

type TransformImageFn = (params: {
  input: Buffer;
  sourceMimeType: string;
  variantKey: VariantKey;
  targetMaxWidth: number;
  targetMaxHeight: number;
}) => Promise<TransformOutput>;



type MediaAssetRecord = {
  id: string;
  kind: string;
  storageKey: string;
  mimeType: string;
  variants: Array<{ key: string }>;
};

type MediaVariantUpsertInput = {
  where: { mediaAssetId_key: { mediaAssetId: string; key: string } };
  update: {
    storageKey: string;
    publicUrl: string;
    width: number;
    height: number;
    mimeType: string;
    byteSize: number;
  };
  create: {
    mediaAssetId: string;
    key: string;
    storageKey: string;
    publicUrl: string;
    width: number;
    height: number;
    mimeType: string;
    byteSize: number;
  };
};

type MediaVariantDeps = {
  findAssetWithVariants: (mediaAssetId: string) => Promise<MediaAssetRecord | null>;
  upsertVariant: (payload: MediaVariantUpsertInput) => Promise<unknown>;
  resolveUploadConfig: typeof resolveUploadConfig;
  readStorageObjectBuffer: typeof readStorageObjectBuffer;
  writeStorageObjectBuffer: typeof writeStorageObjectBuffer;
  resolvePublicUrlForStorageKey: typeof resolvePublicUrlForStorageKey;
};
const WEBP_QUALITY_BY_VARIANT: Record<VariantKey, number> = {
  thumb: 68,
  card: 72,
  card_2x: 74,
  gallery_thumb: 70,
  gallery_main: 78,
  gallery_main_2x: 80,
  lightbox: 82,
  lightbox_2x: 84,
  hero_mobile: 78,
  hero_desktop: 78,
  hero_desktop_2x: 82,
  logo_header: 84,
  logo_footer: 84,
  logo_2x: 86,
};
const PNG_COMPRESSION_LEVEL_BY_VARIANT: Record<VariantKey, number> = {
  thumb: 9,
  card: 9,
  card_2x: 9,
  gallery_thumb: 9,
  gallery_main: 9,
  gallery_main_2x: 9,
  lightbox: 9,
  lightbox_2x: 9,
  hero_mobile: 9,
  hero_desktop: 9,
  hero_desktop_2x: 9,
  logo_header: 9,
  logo_footer: 9,
  logo_2x: 9,
};

export function resolveVariantOutputMimeType(params: {
  sourceMimeType: string;
  hasTransparentPixels: boolean;
}): "image/webp" | "image/png" {
  const normalizedMime = params.sourceMimeType.toLowerCase();
  if (normalizedMime === "image/png" && params.hasTransparentPixels) return "image/png";
  if (normalizedMime === "image/webp" && params.hasTransparentPixels) return "image/webp";
  return "image/webp";
}

async function transformImageWithSharp(params: {
  input: Buffer;
  sourceMimeType: string;
  variantKey: VariantKey;
  targetMaxWidth: number;
  targetMaxHeight: number;
}): Promise<TransformOutput> {
  let sharpModule: any;
  try {
    sharpModule = await import("sharp");
  } catch {
    throw new Error("Image transformer unavailable: install optional dependency \"sharp\" to enable media variant transforms.");
  }

  const sharpFactory = sharpModule.default ?? sharpModule;
  const pipeline = sharpFactory(params.input, { failOn: "warning" }).rotate();
  const stats = await pipeline.stats();
  const hasTransparentPixels = stats.isOpaque === false;
  const targetMimeType = resolveVariantOutputMimeType({
    sourceMimeType: params.sourceMimeType,
    hasTransparentPixels,
  });

  const resized = pipeline.resize({
    width: params.targetMaxWidth,
    height: params.targetMaxHeight,
    fit: "inside",
    withoutEnlargement: true,
  });

  const encoded = targetMimeType === "image/png"
    ? resized.png({ compressionLevel: PNG_COMPRESSION_LEVEL_BY_VARIANT[params.variantKey], adaptiveFiltering: true, effort: 9 })
    : resized.webp({ quality: WEBP_QUALITY_BY_VARIANT[params.variantKey], effort: 6, alphaQuality: 88, smartSubsample: true });

  const infoResult = await encoded.toBuffer({ resolveWithObject: true });
  return {
    buffer: infoResult.data,
    width: infoResult.info.width,
    height: infoResult.info.height,
    mimeType: targetMimeType,
  };
}

export async function isSharpTransformerAvailable(): Promise<boolean> {
  try {
    await import("sharp");
    return true;
  } catch {
    return false;
  }
}

let transformImage: TransformImageFn = transformImageWithSharp;

let mediaVariantDeps: MediaVariantDeps = {
  findAssetWithVariants: async (mediaAssetId) => prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    include: { variants: true },
  }) as Promise<MediaAssetRecord | null>,
  upsertVariant: (payload) => prisma.mediaVariant.upsert(payload),
  resolveUploadConfig,
  readStorageObjectBuffer,
  writeStorageObjectBuffer,
  resolvePublicUrlForStorageKey,
};


export function __setMediaVariantTransformerForTests(transformer: TransformImageFn) {
  transformImage = transformer;
}

export function __resetMediaVariantTransformerForTests() {
  transformImage = transformImageWithSharp;
}

export function __setMediaVariantDepsForTests(overrides: Partial<MediaVariantDeps>) {
  mediaVariantDeps = { ...mediaVariantDeps, ...overrides };
}

export function __resetMediaVariantDepsForTests() {
  mediaVariantDeps = {
    findAssetWithVariants: async (mediaAssetId) => prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      include: { variants: true },
    }) as Promise<MediaAssetRecord | null>,
    upsertVariant: (payload) => prisma.mediaVariant.upsert(payload),
    resolveUploadConfig,
    readStorageObjectBuffer,
    writeStorageObjectBuffer,
    resolvePublicUrlForStorageKey,
  };
}

export async function generateMediaVariantsForAsset(
  mediaAssetId: string,
  options: { force?: boolean; variantKeys?: VariantKey[] } = {},
) {
  const asset = await mediaVariantDeps.findAssetWithVariants(mediaAssetId);
  if (!asset || asset.kind !== "IMAGE") return { generated: 0, skipped: 0, failed: 0, errors: [] as string[] };

  const cfg = await mediaVariantDeps.resolveUploadConfig();
  const original = await mediaVariantDeps.readStorageObjectBuffer(asset.storageKey, cfg);
  const requestedSpecs = options.variantKeys?.length
    ? MEDIA_VARIANT_SPECS.filter((spec) => options.variantKeys?.includes(spec.key))
    : MEDIA_VARIANT_SPECS;

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const spec of requestedSpecs) {
    const existing = asset.variants.find((variant) => variant.key === spec.key);
    if (existing && !options.force) {
      skipped += 1;
      continue;
    }

    try {
      const transformed = await transformImage({
        input: original,
        sourceMimeType: asset.mimeType,
        variantKey: spec.key,
        targetMaxWidth: spec.maxWidth,
        targetMaxHeight: spec.maxHeight,
      });

      const extension = transformed.mimeType === "image/png" ? "png" : transformed.mimeType === "image/webp" ? "webp" : "bin";
      const storageKey = `variants/${asset.id}/${spec.key}.${extension}`;
      await mediaVariantDeps.writeStorageObjectBuffer(storageKey, transformed.buffer, transformed.mimeType, cfg);

      await mediaVariantDeps.upsertVariant({
        where: { mediaAssetId_key: { mediaAssetId: asset.id, key: spec.key } },
        update: {
          storageKey,
          publicUrl: mediaVariantDeps.resolvePublicUrlForStorageKey(storageKey, cfg),
          width: transformed.width,
          height: transformed.height,
          mimeType: transformed.mimeType,
          byteSize: transformed.buffer.byteLength,
        },
        create: {
          mediaAssetId: asset.id,
          key: spec.key,
          storageKey,
          publicUrl: mediaVariantDeps.resolvePublicUrlForStorageKey(storageKey, cfg),
          width: transformed.width,
          height: transformed.height,
          mimeType: transformed.mimeType,
          byteSize: transformed.buffer.byteLength,
        },
      });
      generated += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${spec.key}: ${message}`);
    }
  }

  return { generated, skipped, failed, errors };
}

export const MEDIA_VARIANT_FORMAT_POLICY = {
  source: {
    "image/jpeg": "derived variants encoded as image/webp",
    "image/png": "transparent PNGs -> image/png, opaque PNGs -> image/webp",
    "image/webp": "transparent WebP -> image/webp, opaque WebP -> image/webp",
  },
  quality: {
    webpByVariant: WEBP_QUALITY_BY_VARIANT,
    pngCompressionByVariant: PNG_COMPRESSION_LEVEL_BY_VARIANT,
  },
  notes: [
    "Transparency detection is based on actual pixel opacity (sharp stats.isOpaque), not only channel presence.",
    "Original upload is always retained and never mutated.",
    "Resize uses fit=inside with withoutEnlargement=true (no upscaling).",
    "Variants are generated per key and upserted idempotently.",
  ],
} as const;
