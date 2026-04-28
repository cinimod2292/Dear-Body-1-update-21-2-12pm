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
  (prisma.mediaAsset as any).findUnique = async () => ({
    id: "asset_1",
    kind: "IMAGE",
    mimeType: "image/jpeg",
    storageKey: "uploads/2026-04-28/asset_1.jpg",
    _count: { variants: 0 },
  });
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
  (prisma.mediaAsset as any).findUnique = async () => ({
    id: "asset_missing",
    kind: "IMAGE",
    mimeType: "image/jpeg",
    storageKey: "uploads/2026-04-28/asset_missing.jpg",
    _count: { variants: 0 },
  });
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

test("runMediaVariantsBackfill coerces image mime assets to IMAGE kind before generation", async (t) => {
  __setMediaVariantsBackfillDepsForTests({
    isSharpTransformerAvailable: async () => true,
    generateMediaVariantsForAsset: async () => ({ generated: 1, skipped: 0, failed: 0, errors: [] }),
  });
  const originalFindMany = (prisma.mediaAsset as any).findMany;
  const originalFindUnique = (prisma.mediaAsset as any).findUnique;
  const originalUpdate = (prisma.mediaAsset as any).update;
  (prisma.mediaAsset as any).findMany = async () => [{ id: "asset_file_image" }];
  (prisma.mediaAsset as any).findUnique = async () => ({
    id: "asset_file_image",
    kind: "FILE",
    mimeType: "image/png",
    storageKey: "uploads/2026-04-28/asset_file_image.png",
    _count: { variants: 0 },
  });
  let updatedKind: string | null = null;
  (prisma.mediaAsset as any).update = async ({ data }: any) => {
    updatedKind = data.kind;
    return { id: "asset_file_image" };
  };
  t.after(() => {
    (prisma.mediaAsset as any).findMany = originalFindMany;
    (prisma.mediaAsset as any).findUnique = originalFindUnique;
    (prisma.mediaAsset as any).update = originalUpdate;
  });

  const result = await runMediaVariantsBackfill({ all: true });
  assert.equal(updatedKind, "IMAGE");
  assert.equal(result.generated, 1);
  assert.equal(result.diagnostics[0]?.status, "generated");
});
