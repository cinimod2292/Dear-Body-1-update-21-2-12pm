import test from "node:test";
import assert from "node:assert/strict";
import { regenerateVariantsForMediaIds } from "./media-variants-batch.js";

test("regenerateVariantsForMediaIds returns per-media results and summary", async () => {
  const result = await regenerateVariantsForMediaIds(["m1", "m2", "m3"], {
    concurrency: 2,
    runSingle: async (mediaId) => {
      if (mediaId === "m1") return { generated: 2, skipped: 4, failed: 0 };
      if (mediaId === "m2") return { generated: 0, skipped: 0, failed: 8 };
      return { generated: 0, skipped: 0, failed: 0 };
    },
  });

  assert.deepEqual(result.results.map((row) => row.status), ["ok", "failed", "noop"]);
  assert.deepEqual(result.summary, { total: 3, ok: 1, failed: 1, noop: 1 });
});


test("regenerateVariantsForMediaIds marks thrown errors as failed", async () => {
  const result = await regenerateVariantsForMediaIds(["m1"], {
    runSingle: async () => {
      throw new Error("boom");
    },
  });

  assert.equal(result.results[0]?.status, "failed");
  assert.match(result.results[0]?.error ?? "", /boom/);
});
