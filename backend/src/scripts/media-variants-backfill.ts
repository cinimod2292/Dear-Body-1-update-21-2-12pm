import { prisma } from "../lib/prisma.js";
import { runMediaVariantsBackfill } from "../modules/media/media-variants-backfill.service.js";

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

async function main() {
  const args = parseArgs();
  if (!args.assetId && !args.productId && !args.all) {
    throw new Error("Provide one of --asset <id>, --product <id>, or --all");
  }
  const result = await runMediaVariantsBackfill(args, (message, meta) => {
    // eslint-disable-next-line no-console
    console.log(`[media-variants] ${message}`, meta ?? {});
  });
  // eslint-disable-next-line no-console
  console.log(`[media-variants] complete assets=${result.assetsProcessed} generated=${result.generated} skipped=${result.skipped} failed=${result.failed}`);
}

main().finally(async () => {
  await prisma.$disconnect();
});
