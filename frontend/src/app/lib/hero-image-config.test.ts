import test from "node:test";
import assert from "node:assert/strict";
import { resolveHeroImageConfig } from "./hero-image-config";

test("resolveHeroImageConfig prefers CMS hero URL when present", () => {
  const cfg = resolveHeroImageConfig({ backgroundImageUrl: "https://cdn.example.com/variants/uploads/hero/hero_desktop.webp" });
  assert.equal(cfg.imageUrl, "https://cdn.example.com/variants/uploads/hero/hero_desktop.webp");
});

test("resolveHeroImageConfig returns null for legacy/original upload hero URLs", () => {
  const cfg = resolveHeroImageConfig({ backgroundImageUrl: "https://api.example.com/local-upload/uploads/hero/01b39ccb-4318-4e0b-a99d-4fed6de0c025-DAX01-1-.jpg" });
  assert.equal(cfg.imageUrl, null);
});
