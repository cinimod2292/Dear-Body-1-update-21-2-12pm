import { prisma } from "../lib/prisma.js";
import { generateMediaVariantsForAsset } from "../modules/media/media-variants.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const result: { assetId?: string; productId?: string; all?: boolean; force?: boolean } = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--asset" && args[i + 1]) result.assetId = args[++i];
    if (arg === "--product" && args[i + 1]) result.productId = args[++i];
    if (arg === "--all") result.all = true;
    if (arg === "--force") result.force = true;
  }
  return result;
}

async function resolveAssetIds(filters: { assetId?: string; productId?: string; all?: boolean }) {
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

  if (filters.all) {
    const assets = await prisma.mediaAsset.findMany({ where: { kind: "IMAGE" }, select: { id: true } });
    return assets.map((asset) => asset.id);
  }

  throw new Error("Provide one of --asset <id>, --product <id>, or --all");
}

async function main() {
  const args = parseArgs();
  const assetIds = await resolveAssetIds(args);
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const assetId of assetIds) {
    const outcome = await generateMediaVariantsForAsset(assetId, { force: args.force });
    generated += outcome.generated;
    skipped += outcome.skipped;
    failed += outcome.failed;
    // eslint-disable-next-line no-console
    console.log(`[media-variants] asset=${assetId} generated=${outcome.generated} skipped=${outcome.skipped} failed=${outcome.failed}`);
  }

  // eslint-disable-next-line no-console
  console.log(`[media-variants] complete assets=${assetIds.length} generated=${generated} skipped=${skipped} failed=${failed}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
