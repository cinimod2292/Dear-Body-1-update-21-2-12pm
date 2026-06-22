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
  assert.match(contract.variants.heroMobile.url, /cdn-cgi\/image\/width=768/);
  assert.match(contract.variants.card.url, /cdn-cgi\/image\/width=600/);
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


test("toMediaAssetContract does not set heroDesktop to raw original for cloudflare-r2 assets", () => {
  const contract = toMediaAssetContract({
    id: "m3",
    kind: "IMAGE",
    storageKey: "uploads/2026/source.jpg",
    mimeType: "image/jpeg",
    metadata: { storageProvider: "cloudflare-r2" },
    variants: [],
  }, { provider: "cloudflare-r2", publicBaseUrl: "https://media.dearbody.co.za", signedUrlTtlSeconds: 900, forcePathStyle: false, region: "auto" } as any);

  assert.notEqual(contract.variants.heroDesktop.url, contract.originalUrl);
  assert.match(contract.variants.heroDesktop.url, /cdn-cgi\/image\/width=1920/);
  assert.match(contract.variants.card.url, /cdn-cgi\/image\/width=600/);
  assert.match(contract.variants.thumbnail.url, /cdn-cgi\/image\/width=300/);
});


test("prefers generated cloudflare delivery URLs over raw legacy jpg rows", () => {
  const contract = toMediaAssetContract({
    id: "m4",
    kind: "IMAGE",
    storageKey: "uploads/legacy/source.jpg",
    mimeType: "image/jpeg",
    variants: [
      { key: "hero_desktop", publicUrl: "/api/media/public/uploads/legacy/source.jpg" },
      { key: "thumb", publicUrl: "/api/media/public/uploads/legacy/source.jpg" },
    ],
  }, { provider: "s3", publicBaseUrl: "https://media.dearbody.co.za", signedUrlTtlSeconds: 900, forcePathStyle: false, region: "auto" } as any);

  assert.match(contract.variants.heroDesktop.url, /cdn-cgi\/image\//);
  assert.match(contract.variants.thumbnail.url, /cdn-cgi\/image\//);
  assert.match(contract.variants.original.url, /uploads\//);
});

test("remote-import asset serves its external publicUrl instead of a bucket redirect", () => {
  const contract = toMediaAssetContract({
    id: "m6",
    kind: "IMAGE",
    storageKey: "remote-import/2026-02-03/abc-05eb6380-hf_image.png",
    mimeType: "image/png",
    publicUrl: "https://legacy-cdn.example.com/05eb6380-hf_image.png",
    variants: [],
  }, { provider: "cloudflare-r2", publicBaseUrl: "https://media.dearbody.co.za", signedUrlTtlSeconds: 900, forcePathStyle: false, region: "auto" } as any);

  assert.equal(contract.originalUrl, "https://legacy-cdn.example.com/05eb6380-hf_image.png");
  assert.equal(contract.publicUrl, "https://legacy-cdn.example.com/05eb6380-hf_image.png");
  // No CDN resize wrapping — the external host isn't behind our delivery pipeline.
  assert.equal(contract.variants.thumbnail.url, "https://legacy-cdn.example.com/05eb6380-hf_image.png");
  assert.equal(contract.variants.card.url, "https://legacy-cdn.example.com/05eb6380-hf_image.png");
  assert.doesNotMatch(contract.variants.thumbnail.url, /cdn-cgi\/image\//);
  assert.doesNotMatch(contract.originalUrl, /media\/public\/remote-import/);
});

test("media full contract shape returns delivery variants and original url", () => {
  const responseLike = { data: toMediaAssetContract({
    id: "m5",
    kind: "IMAGE",
    storageKey: "uploads/2026/full.jpg",
    mimeType: "image/jpeg",
    metadata: { storageProvider: "cloudflare-r2" },
    variants: [],
  }, { provider: "cloudflare-r2", publicBaseUrl: "https://media.dearbody.co.za", signedUrlTtlSeconds: 900, forcePathStyle: false, region: "auto" } as any) };

  assert.match(responseLike.data.variants.heroDesktop.url, /cdn-cgi\/image\//);
  assert.match(responseLike.data.variants.thumbnail.url, /cdn-cgi\/image\//);
  assert.match(responseLike.data.variants.original.url, /uploads\//);
});
