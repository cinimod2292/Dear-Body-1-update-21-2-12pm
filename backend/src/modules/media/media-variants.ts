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

export async function generateMediaVariantsForAsset(
  mediaAssetId: string,
  options: { force?: boolean; variantKeys?: VariantKey[] } = {},
) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    include: { variants: true },
  });
  if (!asset || asset.kind !== "IMAGE") return { generated: 0, skipped: 0, failed: 0 };

  const cfg = await resolveUploadConfig();
  const original = await readStorageObjectBuffer(asset.storageKey, cfg);
  const originalWidth = Number(asset.metadata && typeof asset.metadata === "object" ? (asset.metadata as Record<string, unknown>).width : undefined) || 0;
  const originalHeight = Number(asset.metadata && typeof asset.metadata === "object" ? (asset.metadata as Record<string, unknown>).height : undefined) || 0;
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
      const storageKey = `variants/${asset.id}/${spec.key}-${asset.storageKey.split("/").pop() ?? "asset"}`;
      await writeStorageObjectBuffer(storageKey, original, asset.mimeType, cfg);
      const width = originalWidth > 0 ? Math.min(originalWidth, spec.maxWidth) : spec.maxWidth;
      const height = originalHeight > 0 ? Math.min(originalHeight, spec.maxHeight) : spec.maxHeight;

      await prisma.mediaVariant.upsert({
        where: { mediaAssetId_key: { mediaAssetId: asset.id, key: spec.key } },
        update: {
          storageKey,
          publicUrl: resolvePublicUrlForStorageKey(storageKey, cfg),
          width,
          height,
          mimeType: asset.mimeType,
          byteSize: original.byteLength,
        },
        create: {
          mediaAssetId: asset.id,
          key: spec.key,
          storageKey,
          publicUrl: resolvePublicUrlForStorageKey(storageKey, cfg),
          width,
          height,
          mimeType: asset.mimeType,
          byteSize: original.byteLength,
        },
      });
      generated += 1;
    } catch {
      failed += 1;
    }
  }

  return { generated, skipped, failed };
}
