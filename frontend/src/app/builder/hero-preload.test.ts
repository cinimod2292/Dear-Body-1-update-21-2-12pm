import test from "node:test";
import assert from "node:assert/strict";
import { getBuilderHeroImageUrl, heroPreloadDescriptor } from "./hero-preload";

test("getBuilderHeroImageUrl prefers first enabled hero with safe URL", () => {
  const url = getBuilderHeroImageUrl({
    sections: [
      { id: "hero", type: "hero_banner", enabled: true, props: { imageUrl: "https://cdn.example.com/hero.webp" } },
    ],
  } as any);
  assert.equal(url, "https://cdn.example.com/hero.webp");
});

test("getBuilderHeroImageUrl rejects unsafe URLs", () => {
  const url = getBuilderHeroImageUrl({
    sections: [
      { id: "hero", type: "hero_banner", enabled: true, props: { imageUrl: "javascript:alert(1)" } },
    ],
  } as any);
  assert.equal(url, null);
});

test("heroPreloadDescriptor returns stable preload attributes", () => {
  assert.deepEqual(heroPreloadDescriptor("https://cdn.example.com/hero.webp"), {
    rel: "preload",
    as: "image",
    href: "https://cdn.example.com/hero.webp",
    imagesizes: "100vw",
  });
});
