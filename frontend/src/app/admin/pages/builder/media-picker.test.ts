import test from "node:test";
import assert from "node:assert/strict";
import { isHeroImageField, mapSelectedMediaToFieldValue, mapSelectedMediaVariantToFieldValue, mediaAssetToImageUrl, resolveHeroImageSelection, resolveNextImageValue } from "./media-picker";

test("mediaAssetToImageUrl extracts safe media URL", () => {
  assert.equal(mediaAssetToImageUrl({ originalUrl: "https://cdn.example.com/a.jpg" } as any), "https://cdn.example.com/a.jpg");
});

test("mediaAssetToImageUrl rejects unsafe URL", () => {
  assert.equal(mediaAssetToImageUrl({ publicUrl: "javascript:alert(1)" } as any), null);
});

test("resolveNextImageValue keeps current value on unsafe candidate", () => {
  assert.equal(resolveNextImageValue("https://safe.example.com/current.jpg", "javascript:alert(1)"), "https://safe.example.com/current.jpg");
});

test("mapSelectedMediaToFieldValue maps selected media URL", () => {
  assert.equal(mapSelectedMediaToFieldValue("", { originalUrl: "https://cdn.example.com/new.jpg" } as any), "https://cdn.example.com/new.jpg");
});

test("mapSelectedMediaVariantToFieldValue prefers contract variant URL", () => {
  assert.equal(
    mapSelectedMediaVariantToFieldValue("", {
      variants: { heroDesktop: { url: "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a.jpg" } },
    } as any, ["heroDesktop", "card"]),
    "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a.jpg",
  );
});

test("mapSelectedMediaVariantToFieldValue does not fallback to original for hero selection when disabled", () => {
  assert.equal(
    mapSelectedMediaVariantToFieldValue("https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/current.jpg", {
      publicUrl: "https://cdn.example.com/original.jpg",
      variants: {},
    } as any, ["heroDesktop", "card"], { allowOriginalFallback: false }),
    "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/current.jpg",
  );
});

test("isHeroImageField identifies hero banner imageUrl as hero field", () => {
  assert.equal(isHeroImageField("hero_banner", "imageUrl"), true);
  assert.equal(isHeroImageField("image_text", "imageUrl"), false);
});

test("hero media selection with no variants preserves existing imageUrl and returns warning", () => {
  const result = resolveHeroImageSelection("https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/current.jpg", {
    publicUrl: "https://media.dearbody.co.za/uploads/a/original.jpg",
    variants: {},
  } as any, ["heroDesktop", "card", "thumbnail"]);
  assert.equal(result.shouldUpdate, false);
  assert.match(result.warning ?? "", /cloudflare/i);
});

test("hero media selection with variants returns selected optimized URL", () => {
  const result = resolveHeroImageSelection("", {
    variants: { card: { url: "https://media.dearbody.co.za/cdn-cgi/image/width=480/https://media.dearbody.co.za/uploads/a/original.jpg" } },
  } as any, ["heroDesktop", "card", "thumbnail"]);
  assert.equal(result.shouldUpdate, true);
  assert.equal(result.warning, null);
});


test("hero media selection prefers heroDesktop variant over media public/original URL", () => {
  const result = resolveHeroImageSelection("", {
    publicUrl: "/api/media/public/uploads/a/original.jpg",
    originalUrl: "/api/media/public/uploads/a/original.jpg",
    variants: {
      heroDesktop: { url: "/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a/original.jpg" },
    },
  } as any, ["heroDesktop", "card", "thumbnail"]);
  assert.equal(result.shouldUpdate, true);
  assert.equal(result.nextValue, "/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a/original.jpg");
});
