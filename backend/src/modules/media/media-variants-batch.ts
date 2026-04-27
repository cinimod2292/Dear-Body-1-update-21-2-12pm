import { generateMediaVariantsForAsset } from "./media-variants.js";

export type MediaVariantBatchResult = {
  mediaId: string;
  status: "ok" | "failed" | "noop";
  generated: number;
  skipped: number;
  failed: number;
  error?: string;
  errors?: string[];
};

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function regenerateVariantsForMediaIds(
  mediaIds: string[],
  options: {
    concurrency?: number;
    runSingle?: (mediaId: string) => Promise<{ generated: number; skipped: number; failed: number; errors?: string[] }>;
  } = {},
): Promise<{ results: MediaVariantBatchResult[]; summary: { total: number; ok: number; failed: number; noop: number } }> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 6));
  const runSingle = options.runSingle ?? ((mediaId: string) => generateMediaVariantsForAsset(mediaId));

  const results = await runWithConcurrency(mediaIds, concurrency, async (mediaId): Promise<MediaVariantBatchResult> => {
    try {
      const outcome = await runSingle(mediaId);
      if (outcome.generated > 0 || outcome.skipped > 0) {
        return {
          mediaId,
          status: "ok",
          generated: outcome.generated,
          skipped: outcome.skipped,
          failed: outcome.failed,
          errors: outcome.errors,
        };
      }
      if (outcome.failed > 0) {
        return {
          mediaId,
          status: "failed",
          generated: outcome.generated,
          skipped: outcome.skipped,
          failed: outcome.failed,
          error: "Variant generation failed for all requested variants",
          errors: outcome.errors,
        };
      }
      return {
        mediaId,
        status: "noop",
        generated: outcome.generated,
        skipped: outcome.skipped,
        failed: outcome.failed,
      };
    } catch (error) {
      return {
        mediaId,
        status: "failed",
        generated: 0,
        skipped: 0,
        failed: 0,
        error: error instanceof Error ? error.message : "Variant generation failed",
      };
    }
  });

  return {
    results,
    summary: {
      total: results.length,
      ok: results.filter((item) => item.status === "ok").length,
      failed: results.filter((item) => item.status === "failed").length,
      noop: results.filter((item) => item.status === "noop").length,
    },
  };
}
