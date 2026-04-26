import test from "node:test";
import assert from "node:assert/strict";
import { mapSelectedMediaToFieldValue, mapSelectedMediaVariantToFieldValue, mediaAssetToImageUrl, resolveNextImageValue } from "./media-picker";

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
