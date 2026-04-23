import test from "node:test";
import assert from "node:assert/strict";
import { resolveStorageObjectCacheControl } from "./upload.service.js";

test("resolveStorageObjectCacheControl marks generated variants immutable", () => {
  assert.equal(resolveStorageObjectCacheControl("variants/asset_1/card.webp"), "public, max-age=31536000, immutable");
  assert.equal(resolveStorageObjectCacheControl("/variants/asset_1/card.webp"), "public, max-age=31536000, immutable");
});

test("resolveStorageObjectCacheControl leaves originals unchanged", () => {
  assert.equal(resolveStorageObjectCacheControl("uploads/2026-04-01/source.png"), null);
});
