import test from "node:test";
import assert from "node:assert/strict";
import { chooseOptimizedHeroUrl, requireOptimizedHeroUrl } from "./hero-media";

test("chooseOptimizedHeroUrl prefers hero_desktop and supports publicUrl/url fields", () => {
  const url = chooseOptimizedHeroUrl({
    variants: [
      { key: "card", publicUrl: "https://cdn.example.com/local-upload/variants/asset_1/card.webp" },
      { key: "hero_desktop", url: "https://cdn.example.com/local-upload/variants/asset_1/hero_desktop.webp" },
    ],
  });

  assert.equal(url, "https://cdn.example.com/local-upload/variants/asset_1/hero_desktop.webp");
});

test("chooseOptimizedHeroUrl accepts record/object variant payloads", () => {
  const url = chooseOptimizedHeroUrl({
    variants: {
      card: { publicUrl: "https://cdn.example.com/local-upload/variants/asset_1/card.webp" },
      thumb: "https://cdn.example.com/local-upload/variants/asset_1/thumb.webp",
    },
  });

  assert.equal(url, "https://cdn.example.com/local-upload/variants/asset_1/card.webp");
});

test("requireOptimizedHeroUrl throws clear error when optimized variant missing", () => {
  assert.throws(
    () => requireOptimizedHeroUrl({ variants: [{ key: "hero_desktop", publicUrl: "https://cdn.example.com/local-upload/uploads/asset_1/source.jpg" }] }),
    /No optimized variant URL found for this media asset/,
  );
});
