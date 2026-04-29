import test from "node:test";
import assert from "node:assert/strict";
import { getBuilderHeroImageUrl, heroPreloadDescriptor } from "./hero-preload";

test("getBuilderHeroImageUrl prefers first enabled hero with safe URL", () => {
  const url = getBuilderHeroImageUrl({
    sections: [
      { id: "hero", type: "hero_banner", enabled: true, props: { imageUrl: "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/hero.jpg" } },
    ],
  } as any);
  assert.equal(url, "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/hero.jpg");
});

test("getBuilderHeroImageUrl rejects unsafe URLs", () => {
  const url = getBuilderHeroImageUrl({
    sections: [
      { id: "hero", type: "hero_banner", enabled: true, props: { imageUrl: "javascript:alert(1)" } },
    ],
  } as any);
  assert.equal(url, null);
});

test("getBuilderHeroImageUrl allows original upload JPG URLs", () => {
  const url = getBuilderHeroImageUrl({
    sections: [
      { id: "hero", type: "hero_banner", enabled: true, props: { imageUrl: "https://api.example.com/local-upload/uploads/hero/01b39ccb-4318-4e0b-a99d-4fed6de0c025-DAX01-1-.jpg" } },
    ],
  } as any);
  assert.equal(url, "https://api.example.com/local-upload/uploads/hero/01b39ccb-4318-4e0b-a99d-4fed6de0c025-DAX01-1-.jpg");
});

test("heroPreloadDescriptor returns stable preload attributes", () => {
  assert.deepEqual(heroPreloadDescriptor("https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/hero.jpg"), {
    rel: "preload",
    as: "image",
    href: "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/hero.jpg",
    imagesizes: "100vw",
  });
});
