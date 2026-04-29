import test from "node:test";
import assert from "node:assert/strict";
import {
  __testOnly__choosePreferredImageVariantUrl,
  __testOnly__matchAssetForImageUrl,
  __testOnly__normalizeLookupCandidates,
  __testOnly__resolveCurrentVariantStorageKey,
} from "./builder.service.js";

test("hero variant preference chooses hero_desktop over original", () => {
  const url = __testOnly__choosePreferredImageVariantUrl({
    variants: [
      { key: "card", storageKey: "variants/asset/card.webp" },
      { key: "hero_desktop", storageKey: "variants/asset/hero_desktop.webp" },
    ],
    fallbackStorageKey: "uploads/original.jpg",
    isHero: true,
  }, (storageKey) => `https://cdn.test/${storageKey}`);

  assert.equal(url, "https://cdn.test/variants/asset/hero_desktop.webp");
});

test("hero variant preference avoids oversized original when card/thumb exist", () => {
  const url = __testOnly__choosePreferredImageVariantUrl({
    variants: [
      { key: "thumb", storageKey: "variants/asset/thumb.webp" },
      { key: "card", storageKey: "variants/asset/card.webp" },
    ],
    fallbackStorageKey: "uploads/huge-original.jpg",
    isHero: true,
  }, (storageKey) => `https://cdn.test/${storageKey}`);

  assert.equal(url, "https://cdn.test/variants/asset/card.webp");
});

test("hero variant preference does not fall back to original when optimized variants are missing", () => {
  const url = __testOnly__choosePreferredImageVariantUrl({
    variants: [],
    fallbackStorageKey: "uploads/01b39ccb-4318-4e0b-a99d-4fed6de0c025-DAX01-1-.jpg",
    isHero: true,
  }, (storageKey) => `https://cdn.test/${storageKey}`);

  assert.equal(url, null);
});

test("hero variant preference preserves currently selected safe variant when available", () => {
  const url = __testOnly__choosePreferredImageVariantUrl({
    variants: [
      { key: "card", storageKey: "variants/asset/card.webp" },
      { key: "thumb", storageKey: "variants/asset/thumb.webp" },
    ],
    fallbackStorageKey: "uploads/original.jpg",
    isHero: true,
    currentVariantStorageKey: "variants/asset/thumb.webp",
  }, (storageKey) => `https://cdn.test/${storageKey}`);

  assert.equal(url, "https://cdn.test/variants/asset/thumb.webp");
});

test("lookup candidate normalization supports CDN/signed/original URL path matching", () => {
  const candidates = __testOnly__normalizeLookupCandidates("https://cdn.example.com/media/local-upload/uploads%2Fhero%2F01b39ccb.jpg?X-Amz-Signature=abc#hero");

  assert.ok(candidates.includes("/media/local-upload/uploads/hero/01b39ccb.jpg"));
  assert.ok(candidates.includes("uploads/hero/01b39ccb.jpg"));
});

test("hero image URL from published content resolves to mapped asset and optimized variant URL", () => {
  const assetId = __testOnly__matchAssetForImageUrl(
    "https://cdn.example.com/media/local-upload/uploads%2Fhero%2F01b39ccb.jpg?Expires=123#x",
    [{
      id: "asset_1",
      filename: "01b39ccb.jpg",
      storageKey: "uploads/hero/01b39ccb.jpg",
      publicUrl: "https://api.example.com/local-upload/uploads/hero/01b39ccb.jpg",
      variants: [{ storageKey: "variants/uploads/hero/01b39ccb/hero_desktop.webp", publicUrl: "https://api.example.com/local-upload/variants/uploads/hero/01b39ccb/hero_desktop.webp" }],
    }],
  );
  assert.equal(assetId, "asset_1");

  const url = __testOnly__choosePreferredImageVariantUrl({
    variants: [{ key: "hero_desktop", storageKey: "variants/uploads/hero/01b39ccb/hero_desktop.webp" }],
    fallbackStorageKey: "uploads/hero/01b39ccb.jpg",
    isHero: true,
  }, (storageKey) => `https://cdn.example.com/${storageKey}`);
  assert.equal(url, "https://cdn.example.com/variants/uploads/hero/01b39ccb/hero_desktop.webp");
});

test("backend normalization resolves currently selected signed card variant for hero", () => {
  const storageKey = __testOnly__resolveCurrentVariantStorageKey(
    "https://cdn.example.com/local-upload/variants/uploads/hero/a/card.webp?X-Amz-Signature=abc",
    [
      { storageKey: "variants/uploads/hero/a/thumb.webp", publicUrl: "https://cdn.example.com/local-upload/variants/uploads/hero/a/thumb.webp" },
      { storageKey: "variants/uploads/hero/a/card.webp", publicUrl: "https://cdn.example.com/local-upload/variants/uploads/hero/a/card.webp" },
    ],
  );
  assert.equal(storageKey, "variants/uploads/hero/a/card.webp");
});
