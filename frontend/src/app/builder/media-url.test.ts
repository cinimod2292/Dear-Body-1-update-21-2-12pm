import test from "node:test";
import assert from "node:assert/strict";
import { isSafeImageUrl } from "./media-url";

test("isSafeImageUrl allows optimized variant and https URLs", () => {
  assert.equal(isSafeImageUrl("/api/media/public/variants/asset_1/hero_desktop.webp"), true);
  assert.equal(isSafeImageUrl("https://cdn.example/a.jpg"), true);
});

test("isSafeImageUrl rejects unsafe URL schemes", () => {
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("data:image/png;base64,abc"), false);
  assert.equal(isSafeImageUrl("http://example.com/a.jpg"), false);
  assert.equal(isSafeImageUrl("/uploads/source.jpg"), false);
});
