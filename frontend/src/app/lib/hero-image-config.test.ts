import test from "node:test";
import assert from "node:assert/strict";
import { resolveHeroImageConfig } from "./hero-image-config";

test("resolveHeroImageConfig prefers CMS hero URL when present", () => {
  const cfg = resolveHeroImageConfig({ backgroundImageUrl: "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/hero.jpg" });
  assert.equal(cfg.imageUrl, "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/hero.jpg");
});

test("resolveHeroImageConfig keeps legacy/original upload hero URLs", () => {
  const cfg = resolveHeroImageConfig({ backgroundImageUrl: "https://api.example.com/local-upload/uploads/hero/01b39ccb-4318-4e0b-a99d-4fed6de0c025-DAX01-1-.jpg" });
  assert.equal(cfg.imageUrl, "https://api.example.com/local-upload/uploads/hero/01b39ccb-4318-4e0b-a99d-4fed6de0c025-DAX01-1-.jpg");
});
