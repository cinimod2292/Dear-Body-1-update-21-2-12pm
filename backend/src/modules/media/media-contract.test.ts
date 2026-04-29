import test from "node:test";
import assert from "node:assert/strict";
import { toMediaAssetContract } from "./media-contract.js";

test("cloudflare-native media contract generates delivery variants without DB rows", () => {
  const contract = toMediaAssetContract({
    id: "m1",
    kind: "IMAGE",
    storageKey: "uploads/2026/hero.jpg",
    mimeType: "image/jpeg",
    metadata: { storageProvider: "cloudflare-r2" },
    variants: [],
  }, {
    provider: "cloudflare-r2",
    publicBaseUrl: "https://media.dearbody.co.za",
    signedUrlTtlSeconds: 900,
    forcePathStyle: false,
    region: "auto",
  } as any);

  assert.equal(contract.storageProvider, "cloudflare-r2");
  assert.match(contract.variants.heroDesktop.url, /cdn-cgi\/image\/width=1920/);
  assert.match(contract.variants.heroMobile.url, /cdn-cgi\/image\/width=900/);
  assert.match(contract.variants.card.url, /cdn-cgi\/image\/width=480/);
  assert.equal(contract.variants.original.url, contract.originalUrl);
});

test("legacy media contract still resolves DB variant rows", () => {
  const contract = toMediaAssetContract({
    id: "m2",
    kind: "IMAGE",
    storageKey: "uploads/legacy/source.jpg",
    mimeType: "image/jpeg",
    variants: [{ key: "thumb", storageKey: "variants/m2/thumb.webp", width: 160, height: 160, mimeType: "image/webp" }],
  }, {
    provider: "s3",
    signedUrlTtlSeconds: 900,
    forcePathStyle: false,
    region: "auto",
  } as any);

  assert.match(contract.variants.thumbnail.url, /variants\/m2\/thumb\.webp/);
  assert.ok(contract.variants.card.url.length > 0);
});
