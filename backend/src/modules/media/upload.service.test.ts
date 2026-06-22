import test from "node:test";
import assert from "node:assert/strict";
import { inferContentTypeFromStorageKey, resolveStorageObjectCacheControl } from "./upload.service.js";

test("resolveStorageObjectCacheControl marks generated variants immutable", () => {
  assert.equal(resolveStorageObjectCacheControl("variants/asset_1/card.webp"), "public, max-age=31536000, immutable");
  assert.equal(resolveStorageObjectCacheControl("/variants/asset_1/card.webp"), "public, max-age=31536000, immutable");
});

test("resolveStorageObjectCacheControl leaves originals unchanged", () => {
  assert.equal(resolveStorageObjectCacheControl("uploads/2026-04-01/source.png"), null);
});

test("inferContentTypeFromStorageKey maps common image extensions", () => {
  assert.equal(inferContentTypeFromStorageKey("uploads/2026-06-22/abc-hf_x.png"), "image/png");
  assert.equal(inferContentTypeFromStorageKey("uploads/2026/x.JPG"), "image/jpeg");
  assert.equal(inferContentTypeFromStorageKey("variants/m1/card.webp"), "image/webp");
  assert.equal(inferContentTypeFromStorageKey("uploads/x.svg"), "image/svg+xml");
});

test("inferContentTypeFromStorageKey falls back to octet-stream for unknown extensions", () => {
  assert.equal(inferContentTypeFromStorageKey("uploads/x.bin"), "application/octet-stream");
  assert.equal(inferContentTypeFromStorageKey("uploads/noextension"), "application/octet-stream");
});
