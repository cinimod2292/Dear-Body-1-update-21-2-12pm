import test from "node:test";
import assert from "node:assert/strict";
import { __testOnly__attemptVariantGenerationOnFinalize, __testOnly__regenerateSingleAssetVariants } from "./media.routes.js";

function buildLogger() {
  const calls: Array<{ level: "info" | "warn" | "error"; message: string }> = [];
  const capture = (level: "info" | "warn" | "error", args: unknown[]) => {
    const maybeMessage = args.find((entry) => typeof entry === "string");
    calls.push({ level, message: typeof maybeMessage === "string" ? maybeMessage : "" });
  };
  return {
    logger: {
      info: (...args: unknown[]) => { capture("info", args); },
      warn: (...args: unknown[]) => { capture("warn", args); },
      error: (...args: unknown[]) => { capture("error", args); },
    },
    calls,
  };
}

test("finalize variant generation returns success when generation succeeds", async () => {
  const { logger } = buildLogger();
  const result = await __testOnly__attemptVariantGenerationOnFinalize(
    async () => ({ generated: 3 }),
    logger,
    { timeoutMs: 1000, mediaAssetId: "asset_ok" },
  );
  assert.equal(result.variantsPending, false);
  assert.deepEqual(result.variantErrors, []);
});

test("finalize variant generation returns warning status when generation throws", async () => {
  const { logger } = buildLogger();
  const result = await __testOnly__attemptVariantGenerationOnFinalize(
    async () => {
      throw new Error("sharp unavailable");
    },
    logger,
    { timeoutMs: 1000, mediaAssetId: "asset_err" },
  );
  assert.equal(result.variantsPending, false);
  assert.deepEqual(result.variantErrors, ["sharp unavailable"]);
});

test("finalize variant generation surfaces per-variant errors from generation result", async () => {
  const { logger } = buildLogger();
  const result = await __testOnly__attemptVariantGenerationOnFinalize(
    async () => ({ generated: 0, skipped: 0, failed: 2, errors: ["thumb: sharp missing", "card: sharp missing"] }),
    logger,
    { timeoutMs: 1000, mediaAssetId: "asset_partial_fail" },
  );
  assert.equal(result.variantsPending, false);
  assert.deepEqual(result.variantErrors, ["thumb: sharp missing", "card: sharp missing"]);
});

test("finalize variant generation returns variantsPending on timeout", async () => {
  const { logger } = buildLogger();
  const result = await __testOnly__attemptVariantGenerationOnFinalize(
    () => new Promise((resolve) => setTimeout(() => resolve({ generated: 1 }), 700)),
    logger,
    { timeoutMs: 300, mediaAssetId: "asset_pending" },
  );
  assert.equal(result.variantsPending, true);
  assert.deepEqual(result.variantErrors, []);
});

test("single-asset regenerate returns variant records with per-variant errors", async () => {
  const result = await __testOnly__regenerateSingleAssetVariants("asset_123", {
    runGeneration: async () => ({ generated: 1, skipped: 0, failed: 1, errors: ["card: sharp unavailable"] }),
    loadVariantRecords: async () => ({
      mediaId: "asset_123",
      variants: [
        { key: "hero_desktop", storageKey: "variants/asset_123/hero_desktop.webp", width: 1920, height: 1080, mimeType: "image/webp" },
        { key: "card", storageKey: "variants/asset_123/card.webp", width: 700, height: 700, mimeType: "image/webp" },
      ],
    }),
    resolveVariantPublicUrl: (storageKey) => `https://cdn.test/${storageKey}`,
  });
  assert.equal(result.mediaId, "asset_123");
  assert.equal(result.generated, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.variantErrors, ["card: sharp unavailable"]);
  assert.deepEqual(result.variantKeys, ["hero_desktop", "card"]);
  assert.equal(result.variants[0]?.publicUrl, "https://cdn.test/variants/asset_123/hero_desktop.webp");
});
