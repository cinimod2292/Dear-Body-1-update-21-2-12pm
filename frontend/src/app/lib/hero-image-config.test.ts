import test from "node:test";
import assert from "node:assert/strict";
import { resolveHeroImageConfig } from "./hero-image-config";

test("resolveHeroImageConfig prefers CMS hero URL when present", () => {
  const cfg = resolveHeroImageConfig({ backgroundImageUrl: "https://cdn.example.com/hero.jpg" }, { pngFallbackUrl: "/hero.png", optimizedFallbackUrl: "/hero.webp" });
  assert.equal(cfg.useCmsImage, true);
  assert.equal(cfg.imageUrl, "https://cdn.example.com/hero.jpg");
});

test("resolveHeroImageConfig falls back to optimized local hero assets", () => {
  const cfg = resolveHeroImageConfig({}, { pngFallbackUrl: "/hero.png", optimizedFallbackUrl: "/hero.webp" });
  assert.equal(cfg.useCmsImage, false);
  assert.equal(cfg.optimizedFallbackUrl, "/hero.webp");
  assert.equal(cfg.pngFallbackUrl, "/hero.png");
});
