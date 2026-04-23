import { prisma } from "../../lib/prisma.js";
import { resolvePublicUrlForStorageKey, resolveUploadConfig, readStorageObjectBuffer, writeStorageObjectBuffer } from "./upload.service.js";

export const MEDIA_VARIANT_SPECS = [
  { key: "thumb", maxWidth: 160, maxHeight: 160 },
  { key: "card", maxWidth: 640, maxHeight: 640 },
  { key: "card_2x", maxWidth: 960, maxHeight: 960 },
  { key: "gallery_thumb", maxWidth: 200, maxHeight: 200 },
  { key: "gallery_main", maxWidth: 960, maxHeight: 960 },
  { key: "gallery_main_2x", maxWidth: 1440, maxHeight: 1440 },
  { key: "lightbox", maxWidth: 1600, maxHeight: 1600 },
  { key: "lightbox_2x", maxWidth: 2400, maxHeight: 2400 },
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
const DEFAULT_JPEG_QUALITY = 82;
const DEFAULT_WEBP_QUALITY = 82;
const DEFAULT_PNG_COMPRESSION_LEVEL = 9;

function isTransparentMime(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/webp";
}

async function transformImageWithSharp(params: {
  input: Buffer;
  sourceMimeType: string;
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
  const metadata = await pipeline.metadata();

  const hasAlpha = Boolean(metadata.hasAlpha);
  const targetMimeType = hasAlpha && isTransparentMime(params.sourceMimeType)
    ? "image/png"
    : "image/webp";

  const resized = pipeline.resize({
    width: params.targetMaxWidth,
    height: params.targetMaxHeight,
    fit: "inside",
    withoutEnlargement: true,
  });

  const encoded = targetMimeType === "image/png"
    ? resized.png({ compressionLevel: DEFAULT_PNG_COMPRESSION_LEVEL })
    : resized.webp({ quality: DEFAULT_WEBP_QUALITY, effort: 5 });

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
  if (!asset || asset.kind !== "IMAGE") return { generated: 0, skipped: 0, failed: 0 };

  const cfg = await mediaVariantDeps.resolveUploadConfig();
  const original = await mediaVariantDeps.readStorageObjectBuffer(asset.storageKey, cfg);
  const requestedSpecs = options.variantKeys?.length
    ? MEDIA_VARIANT_SPECS.filter((spec) => options.variantKeys?.includes(spec.key))
    : MEDIA_VARIANT_SPECS;

  let generated = 0;
  let skipped = 0;
  let failed = 0;

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
    } catch {
      failed += 1;
    }
  }

  return { generated, skipped, failed };
}

export const MEDIA_VARIANT_FORMAT_POLICY = {
  source: {
    "image/jpeg": "derived variants encoded as image/webp",
    "image/png": "opaque PNGs -> image/webp, alpha PNGs -> image/png",
    "image/webp": "opaque WebP -> image/webp, alpha WebP -> image/png",
  },
  quality: {
    jpegQuality: DEFAULT_JPEG_QUALITY,
    webpQuality: DEFAULT_WEBP_QUALITY,
    pngCompressionLevel: DEFAULT_PNG_COMPRESSION_LEVEL,
  },
  notes: [
    "Original upload is always retained and never mutated.",
    "Resize uses fit=inside with withoutEnlargement=true (no upscaling).",
    "Variants are generated per key and upserted idempotently.",
  ],
} as const;
