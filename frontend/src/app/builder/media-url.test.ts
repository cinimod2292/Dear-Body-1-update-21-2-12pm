import test from "node:test";
import assert from "node:assert/strict";
import { isLikelyOriginalUploadUrl, isOptimizedVariantUrl, isSafeImageUrl, sanitizeBuilderImageUrl } from "./media-url";

test("isSafeImageUrl allows legacy variant paths and https URLs for non-hero", () => {
  assert.equal(isSafeImageUrl("/api/media/public/variants/asset_1/hero_desktop.webp"), true);
  assert.equal(isSafeImageUrl("https://cdn.example/a.jpg"), true);
});

test("isSafeImageUrl enforces Cloudflare URLs for hero fields", () => {
  assert.equal(isSafeImageUrl("https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a.jpg", { isHero: true }), true);
  assert.equal(isSafeImageUrl("https://imagedelivery.net/hash/id/public", { isHero: true }), true);
  assert.equal(isSafeImageUrl("https://cdn.example.com/a.jpg", { isHero: true }), false);
});

test("isSafeImageUrl rejects unsafe URL schemes", () => {
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("data:image/png;base64,abc"), false);
  assert.equal(isSafeImageUrl("http://example.com/a.jpg"), false);
  assert.equal(isSafeImageUrl("/uploads/source.jpg"), false);
});

test("variant/original heuristics detect optimized and original upload URLs", () => {
  assert.equal(isOptimizedVariantUrl("https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a/hero.jpg"), true);
  assert.equal(isLikelyOriginalUploadUrl("https://cdn.example.com/local-upload/uploads/a/huge-source.jpg"), true);
});

test("sanitizeBuilderImageUrl rejects likely original upload URL for hero preview", () => {
  assert.equal(
    sanitizeBuilderImageUrl("https://cdn.example.com/local-upload/uploads/a/huge-source.jpg", { isHero: true }),
    null,
  );
});

test("sanitizeBuilderImageUrl allows Cloudflare variant URLs", () => {
  assert.equal(
    sanitizeBuilderImageUrl("https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a/hero.jpg", { isHero: true }),
    "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a/hero.jpg",
  );
});
