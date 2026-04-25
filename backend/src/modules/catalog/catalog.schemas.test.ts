import test from "node:test";
import assert from "node:assert/strict";
import { attachProductImagesSchema } from "./catalog.schemas.js";

test("attachProductImagesSchema validates mediaAssetIds payload", () => {
  const parsed = attachProductImagesSchema.parse({ mediaAssetIds: ["ckf3w9j4b0000q4m1z3zv0a1b"] });
  assert.equal(parsed.mediaAssetIds.length, 1);

  assert.throws(() => attachProductImagesSchema.parse({ mediaAssetIds: [] }));
});
