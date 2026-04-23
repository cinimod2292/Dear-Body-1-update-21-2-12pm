import { prisma } from "../../lib/prisma.js";
import { generateMediaVariantsForAsset, isSharpTransformerAvailable } from "./media-variants.js";

export type MediaVariantsBackfillOptions = {
  assetId?: string;
  productId?: string;
  all?: boolean;
  force?: boolean;
};

export type MediaVariantsBackfillResult = {
  mode: "all" | "product" | "asset";
  assetIds: string[];
  assetsProcessed: number;
  generated: number;
  skipped: number;
  failed: number;
  failures: Array<{ assetId: string; generated: number; skipped: number; failed: number }>;
  sharpAvailable: boolean;
};

export function resolveBackfillMode(options: MediaVariantsBackfillOptions): "all" | "product" | "asset" {
  if (options.assetId) return "asset";
  if (options.productId) return "product";
  return "all";
}

export async function resolveBackfillAssetIds(filters: MediaVariantsBackfillOptions): Promise<string[]> {
  if (filters.assetId) return [filters.assetId];

  if (filters.productId) {
    const product = await prisma.product.findUnique({
      where: { id: filters.productId },
      include: { galleries: { select: { mediaAssetId: true } }, hoverImage: { select: { id: true } } },
    });
    if (!product) return [];
    return [...new Set([
      ...product.galleries.map((gallery) => gallery.mediaAssetId),
      product.hoverImage?.id,
    ].filter((value): value is string => Boolean(value)))];
  }

  const assets = await prisma.mediaAsset.findMany({ where: { kind: "IMAGE" }, select: { id: true } });
  return assets.map((asset) => asset.id);
}

export async function runMediaVariantsBackfill(
  options: MediaVariantsBackfillOptions,
  log: (message: string, meta?: Record<string, unknown>) => void = () => {},
): Promise<MediaVariantsBackfillResult> {
  const mode = resolveBackfillMode(options);
  const sharpAvailable = await isSharpTransformerAvailable();

  if (!sharpAvailable) {
    log("media variant transformer unavailable", { sharpAvailable: false, mode });
    throw new Error("Media variant transformer unavailable: sharp dependency is not available in this runtime.");
  }
  const assetIds = await resolveBackfillAssetIds(options);

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const failures: MediaVariantsBackfillResult["failures"] = [];

  for (const assetId of assetIds) {
    const outcome = await generateMediaVariantsForAsset(assetId, { force: options.force });
    generated += outcome.generated;
    skipped += outcome.skipped;
    failed += outcome.failed;

    log("media variant asset processed", {
      assetId,
      generated: outcome.generated,
      skipped: outcome.skipped,
      failed: outcome.failed,
    });

    if (outcome.failed > 0) {
      failures.push({
        assetId,
        generated: outcome.generated,
        skipped: outcome.skipped,
        failed: outcome.failed,
      });
    }
  }

  return {
    mode,
    assetIds,
    assetsProcessed: assetIds.length,
    generated,
    skipped,
    failed,
    failures,
    sharpAvailable,
  };
}
