import test from "node:test";
import assert from "node:assert/strict";
import { isLikelyOriginalUploadUrl, isOptimizedVariantUrl, isSafeImageUrl, sanitizeBuilderImageUrl } from "./media-url";

test("isSafeImageUrl allows relative and https URLs", () => {
  assert.equal(isSafeImageUrl("/uploads/a.jpg"), true);
  assert.equal(isSafeImageUrl("https://cdn.example/a.jpg"), true);
});

test("isSafeImageUrl rejects unsafe URL schemes", () => {
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("http://example.com/a.jpg"), false);
});

test("variant/original heuristics detect optimized and original upload URLs", () => {
  assert.equal(isOptimizedVariantUrl("https://cdn.example.com/local-upload/variants/uploads/a/hero_desktop.webp"), true);
  assert.equal(isLikelyOriginalUploadUrl("https://cdn.example.com/local-upload/uploads/a/huge-source.jpg"), true);
});

test("sanitizeBuilderImageUrl rejects likely original upload URL for hero preview", () => {
  assert.equal(
    sanitizeBuilderImageUrl("https://cdn.example.com/local-upload/uploads/a/huge-source.jpg", { isHero: true }),
    null,
  );
});

test("sanitizeBuilderImageUrl allows safe variant URLs (relative/signed/CDN)", () => {
  assert.equal(
    sanitizeBuilderImageUrl("/variants/uploads/a/hero_desktop.webp", { isHero: true }),
    "/variants/uploads/a/hero_desktop.webp",
  );
  assert.equal(
    sanitizeBuilderImageUrl("https://cdn.example.com/local-upload/variants/uploads/a/card.webp?X-Amz-Signature=abc", { isHero: true }),
    "https://cdn.example.com/local-upload/variants/uploads/a/card.webp?X-Amz-Signature=abc",
  );
  assert.equal(
    sanitizeBuilderImageUrl("https://images.example.com/media/hero_desktop.webp", { isHero: true }),
    "https://images.example.com/media/hero_desktop.webp",
  );
});
