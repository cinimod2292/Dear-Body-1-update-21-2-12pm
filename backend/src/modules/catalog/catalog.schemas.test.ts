import test from "node:test";
import assert from "node:assert/strict";
import { attachProductImagesSchema, legacyImageMigrationSchema } from "./catalog.schemas.js";

test("attachProductImagesSchema validates mediaAssetIds payload", () => {
  const parsed = attachProductImagesSchema.parse({ mediaAssetIds: ["ckf3w9j4b0000q4m1z3zv0a1b"] });
  assert.equal(parsed.mediaAssetIds.length, 1);

  assert.throws(() => attachProductImagesSchema.parse({ mediaAssetIds: [] }));
});

test("legacyImageMigrationSchema supports dry-run and execute modes", () => {
  const dryRun = legacyImageMigrationSchema.parse({});
  assert.equal(dryRun.dryRun, true);

  const execute = legacyImageMigrationSchema.parse({
    dryRun: false,
    productIds: ["ckf3w9j4b0000q4m1z3zv0a1b"],
  });
  assert.equal(execute.dryRun, false);
});
