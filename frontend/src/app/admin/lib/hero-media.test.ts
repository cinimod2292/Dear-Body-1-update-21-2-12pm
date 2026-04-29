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


test("hero selector accepts Cloudflare-native heroDesktop URL", () => {
  const url = chooseOptimizedHeroUrl({
    variants: {
      heroDesktop: { url: "https://media.example.com/cdn-cgi/image/width=1920/https://media.example.com/uploads/a.jpg" },
    },
  });
  assert.equal(url, "https://media.example.com/cdn-cgi/image/width=1920/https://media.example.com/uploads/a.jpg");
});

test("hero selector rejects raw admin media original jpg", () => {
  assert.throws(() => requireOptimizedHeroUrl({
    variants: {
      heroDesktop: { url: "/admin/media/public/uploads/a/source.jpg" },
    },
  }), /No optimized variant URL found/);
});


test("requireOptimizedHeroUrl ignores raw heroDesktop URL and falls back to optimized card variant", () => {
  const picked = requireOptimizedHeroUrl({
    variants: {
      heroDesktop: { url: "/api/media/public/uploads/a/raw.jpg" },
      card: { url: "/cdn-cgi/image/width=600/https://media.dearbody.co.za/uploads/a/raw.jpg" },
    },
  });
  assert.equal(picked, "/cdn-cgi/image/width=600/https://media.dearbody.co.za/uploads/a/raw.jpg");
});
