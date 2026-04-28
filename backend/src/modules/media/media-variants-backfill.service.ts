import { prisma } from "../../lib/prisma.js";
import { generateMediaVariantsForAsset, isSharpTransformerAvailable } from "./media-variants.js";

export type MediaVariantsBackfillOptions = {
  assetId?: string;
  productId?: string;
  all?: boolean;
  force?: boolean;
  maxAssets?: number;
};

export type MediaVariantsBackfillResult = {
  mode: "all" | "product" | "asset";
  scanned: number;
  assetIds: string[];
  assetsProcessed: number;
  skippedAssets: number;
  generated: number;
  skipped: number;
  failed: number;
  diagnostics: Array<{ assetId: string; status: "generated" | "skipped" | "failed"; generated: number; skipped: number; failed: number; reason: string; errors?: string[]; storageKey?: string; mimeType?: string; variantsCount?: number }>;
  failures: Array<{ assetId: string; generated: number; skipped: number; failed: number; errors?: string[] }>;
  sharpAvailable: boolean;
  truncated: boolean;
};

export function resolveBackfillMode(options: MediaVariantsBackfillOptions): "all" | "product" | "asset" {
  if (options.assetId) return "asset";
  if (options.productId) return "product";
  return "all";
}

type BackfillDeps = {
  isSharpTransformerAvailable: typeof isSharpTransformerAvailable;
  generateMediaVariantsForAsset: typeof generateMediaVariantsForAsset;
};

let backfillDeps: BackfillDeps = {
  isSharpTransformerAvailable,
  generateMediaVariantsForAsset,
};

export function __setMediaVariantsBackfillDepsForTests(overrides: Partial<BackfillDeps>) {
  backfillDeps = { ...backfillDeps, ...overrides };
}

export function __resetMediaVariantsBackfillDepsForTests() {
  backfillDeps = {
    isSharpTransformerAvailable,
    generateMediaVariantsForAsset,
  };
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

  const assets = await prisma.mediaAsset.findMany({
    where: {
      OR: [
        { kind: "IMAGE" },
        { mimeType: { startsWith: "image/" } },
      ],
    },
    select: { id: true },
  });
  return assets.map((asset) => asset.id);
}

export async function runMediaVariantsBackfill(
  options: MediaVariantsBackfillOptions,
  log: (message: string, meta?: Record<string, unknown>) => void = () => {},
): Promise<MediaVariantsBackfillResult> {
  const mode = resolveBackfillMode(options);
  const sharpAvailable = await backfillDeps.isSharpTransformerAvailable();

  if (!sharpAvailable) {
    log("media variant transformer unavailable", { sharpAvailable: false, mode });
    throw new Error("Media variant transformer unavailable: sharp dependency is not available in this runtime.");
  }
  const assetIds = await resolveBackfillAssetIds(options);
  const maxAssets = Math.max(1, options.maxAssets ?? assetIds.length);
  const scopedAssetIds = assetIds.slice(0, maxAssets);
  const truncated = scopedAssetIds.length < assetIds.length;

  let skippedAssets = 0;
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const diagnostics: MediaVariantsBackfillResult["diagnostics"] = [];
  const failures: MediaVariantsBackfillResult["failures"] = [];

  for (const assetId of scopedAssetIds) {
    try {
      const media = await prisma.mediaAsset.findUnique({
        where: { id: assetId },
        select: { id: true, kind: true, mimeType: true, storageKey: true, _count: { select: { variants: true } } },
      });
      if (!media) {
        skippedAssets += 1;
        diagnostics.push({ assetId, status: "skipped", generated: 0, skipped: 0, failed: 0, reason: "asset_not_found" });
        log("media variant asset skipped", { assetId, reason: "asset_not_found" });
        continue;
      }
      const isImageMime = String(media.mimeType || "").toLowerCase().startsWith("image/");
      if (media.kind !== "IMAGE" && !isImageMime) {
        skippedAssets += 1;
        diagnostics.push({
          assetId,
          status: "skipped",
          generated: 0,
          skipped: 0,
          failed: 0,
          reason: `unsupported_kind:${media.kind}`,
          storageKey: media.storageKey,
          mimeType: media.mimeType,
          variantsCount: media._count.variants,
        });
        log("media variant asset skipped", { assetId, reason: "unsupported_kind", kind: media.kind, mimeType: media.mimeType });
        continue;
      }
      if (media.kind !== "IMAGE" && isImageMime) {
        await prisma.mediaAsset.update({
          where: { id: assetId },
          data: { kind: "IMAGE" },
        });
        log("media asset kind normalized before backfill", { assetId, previousKind: media.kind, mimeType: media.mimeType });
      }

      const outcome = await backfillDeps.generateMediaVariantsForAsset(assetId, { force: options.force });
      generated += outcome.generated;
      skipped += outcome.skipped;
      failed += outcome.failed;
      const hasNoOutcome = outcome.generated === 0 && outcome.skipped === 0 && outcome.failed === 0;
      if (hasNoOutcome) {
        failed += 1;
      }
      const status = hasNoOutcome ? "failed" : outcome.failed > 0 ? "failed" : outcome.generated > 0 ? "generated" : "skipped";
      const reason = outcome.failed > 0
        ? "variant_generation_errors"
        : outcome.generated > 0
          ? "variants_generated"
          : outcome.skipped > 0
            ? "variants_already_exist"
            : "no_variants_generated";
      if (status === "skipped") skippedAssets += 1;

      diagnostics.push({
        assetId,
        status,
        generated: outcome.generated,
        skipped: outcome.skipped,
        failed: outcome.failed,
        reason,
        errors: outcome.errors,
        storageKey: media.storageKey,
        mimeType: media.mimeType,
        variantsCount: media._count.variants,
      });

      log("media variant asset processed", {
        assetId,
        status,
        reason,
        generated: outcome.generated,
        skipped: outcome.skipped,
        failed: outcome.failed,
        errors: outcome.errors,
      });

      if (outcome.failed > 0 || hasNoOutcome) {
        failures.push({
          assetId,
          generated: outcome.generated,
          skipped: outcome.skipped,
          failed: hasNoOutcome ? 1 : outcome.failed,
          errors: hasNoOutcome ? ["No variants were generated or skipped for this image asset."] : outcome.errors,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed += 1;
      diagnostics.push({ assetId, status: "failed", generated: 0, skipped: 0, failed: 1, reason: "unexpected_error", errors: [message] });
      failures.push({ assetId, generated: 0, skipped: 0, failed: 1, errors: [message] });
      log("media variant asset failed unexpectedly", { assetId, error: message });
    }
  }

  return {
    mode,
    scanned: assetIds.length,
    assetIds: scopedAssetIds,
    assetsProcessed: scopedAssetIds.length,
    skippedAssets,
    generated,
    skipped,
    failed,
    diagnostics,
    failures,
    sharpAvailable,
    truncated,
  };
}
