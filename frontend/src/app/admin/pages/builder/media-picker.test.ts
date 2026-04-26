import test from "node:test";
import assert from "node:assert/strict";
import { isHeroImageField, mapSelectedMediaToFieldValue, mapSelectedMediaVariantToFieldValue, mediaAssetToImageUrl, resolveNextImageValue } from "./media-picker";

test("mediaAssetToImageUrl extracts safe media URL", () => {
  assert.equal(mediaAssetToImageUrl({ publicUrl: "https://cdn.example.com/a.jpg" } as any), "https://cdn.example.com/a.jpg");
});

test("mediaAssetToImageUrl rejects unsafe URL", () => {
  assert.equal(mediaAssetToImageUrl({ publicUrl: "javascript:alert(1)" } as any), null);
});

test("resolveNextImageValue keeps current value on unsafe candidate", () => {
  assert.equal(resolveNextImageValue("https://safe.example.com/current.jpg", "javascript:alert(1)"), "https://safe.example.com/current.jpg");
});

test("mapSelectedMediaToFieldValue maps selected media URL", () => {
  assert.equal(mapSelectedMediaToFieldValue("", { publicUrl: "https://cdn.example.com/new.jpg" } as any), "https://cdn.example.com/new.jpg");
});

test("mapSelectedMediaVariantToFieldValue prefers variant URL", () => {
  assert.equal(
    mapSelectedMediaVariantToFieldValue("", {
      publicUrl: "https://cdn.example.com/original.jpg",
      variants: [{ key: "hero_desktop", publicUrl: "https://cdn.example.com/hero.webp" }],
    } as any, ["hero_desktop", "card"]),
    "https://cdn.example.com/hero.webp",
  );
});

test("mapSelectedMediaVariantToFieldValue does not fallback to original for hero selection when disabled", () => {
  assert.equal(
    mapSelectedMediaVariantToFieldValue("https://cdn.example.com/current.webp", {
      publicUrl: "https://cdn.example.com/original.jpg",
      variants: [],
    } as any, ["hero_desktop", "card"], { allowOriginalFallback: false }),
    "https://cdn.example.com/current.webp",
  );
});

test("mapSelectedMediaVariantToFieldValue keeps stable optimized variant URL", () => {
  assert.equal(
    mapSelectedMediaVariantToFieldValue("", {
      publicUrl: "https://cdn.example.com/local-upload/uploads/a/original.jpg",
      variants: [
        { key: "card", publicUrl: "https://cdn.example.com/local-upload/variants/uploads/a/card.webp?X-Amz-Signature=abc" },
        { key: "thumb", publicUrl: "https://cdn.example.com/local-upload/variants/uploads/a/thumb.webp?X-Amz-Signature=abc" },
      ],
    } as any, ["hero_desktop", "card", "thumb"], { allowOriginalFallback: false }),
    "https://cdn.example.com/local-upload/variants/uploads/a/card.webp?X-Amz-Signature=abc",
  );
});

test("isHeroImageField identifies hero banner imageUrl as hero field", () => {
  assert.equal(isHeroImageField("hero_banner", "imageUrl"), true);
  assert.equal(isHeroImageField("image_text", "imageUrl"), false);
});
