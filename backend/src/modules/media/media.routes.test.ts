import test from "node:test";
import assert from "node:assert/strict";
import { __testOnly__attemptVariantGenerationOnFinalize } from "./media.routes.js";

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
