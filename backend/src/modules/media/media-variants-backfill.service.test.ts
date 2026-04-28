import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { __resetMediaVariantsBackfillDepsForTests, __setMediaVariantsBackfillDepsForTests, resolveBackfillMode, runMediaVariantsBackfill } from "./media-variants-backfill.service.js";
import { prisma } from "../../lib/prisma.js";

afterEach(() => {
  __resetMediaVariantsBackfillDepsForTests();
});

test("resolveBackfillMode picks asset > product > all", () => {
  assert.equal(resolveBackfillMode({ assetId: "a1", productId: "p1" }), "asset");
  assert.equal(resolveBackfillMode({ productId: "p1" }), "product");
  assert.equal(resolveBackfillMode({}), "all");
});

test("runMediaVariantsBackfill creates variants for image assets with no variants", async (t) => {
  __setMediaVariantsBackfillDepsForTests({
    isSharpTransformerAvailable: async () => true,
    generateMediaVariantsForAsset: async () => ({ generated: 3, skipped: 0, failed: 0, errors: [] }),
  });
  const originalFindMany = (prisma.mediaAsset as any).findMany;
  const originalFindUnique = (prisma.mediaAsset as any).findUnique;
  (prisma.mediaAsset as any).findMany = async () => [{ id: "asset_1" }];
  (prisma.mediaAsset as any).findUnique = async () => ({ id: "asset_1", kind: "IMAGE" });
  t.after(() => {
    (prisma.mediaAsset as any).findMany = originalFindMany;
    (prisma.mediaAsset as any).findUnique = originalFindUnique;
  });

  const result = await runMediaVariantsBackfill({ all: true });

  assert.equal(result.scanned, 1);
  assert.equal(result.assetsProcessed, 1);
  assert.equal(result.generated, 3);
  assert.equal(result.failed, 0);
  assert.equal(result.diagnostics[0]?.status, "generated");
  assert.equal(result.diagnostics[0]?.reason, "variants_generated");
});

test("runMediaVariantsBackfill reports per-asset failure reason when source file is missing", async (t) => {
  __setMediaVariantsBackfillDepsForTests({
    isSharpTransformerAvailable: async () => true,
    generateMediaVariantsForAsset: async () => {
      throw new Error("Failed to read object uploads/missing.jpg (404)");
    },
  });
  const originalFindMany = (prisma.mediaAsset as any).findMany;
  const originalFindUnique = (prisma.mediaAsset as any).findUnique;
  (prisma.mediaAsset as any).findMany = async () => [{ id: "asset_missing" }];
  (prisma.mediaAsset as any).findUnique = async () => ({ id: "asset_missing", kind: "IMAGE" });
  t.after(() => {
    (prisma.mediaAsset as any).findMany = originalFindMany;
    (prisma.mediaAsset as any).findUnique = originalFindUnique;
  });

  const result = await runMediaVariantsBackfill({ all: true });

  assert.equal(result.failed, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.diagnostics[0]?.status, "failed");
  assert.equal(result.diagnostics[0]?.reason, "unexpected_error");
  assert.match(result.diagnostics[0]?.errors?.[0] ?? "", /Failed to read object/);
});
