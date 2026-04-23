import test from "node:test";
import assert from "node:assert/strict";
import { mapGallerySurfaceImages, resolveCardImage, resolveHoverImageUrl } from "./product-images";

const baseImage = {
  mediaAssetId: "img1",
  url: "https://img/original.jpg",
  width: 2400,
  height: 1600,
  variants: {
    thumb: { url: "https://img/thumb.jpg" },
    card: { url: "https://img/card.jpg" },
    card_2x: { url: "https://img/card-2x.jpg" },
    gallery_thumb: { url: "https://img/gallery-thumb.jpg" },
    gallery_main: { url: "https://img/gallery-main.jpg" },
    gallery_main_2x: { url: "https://img/gallery-main-2x.jpg" },
    lightbox: { url: "https://img/lightbox.jpg" },
    lightbox_2x: { url: "https://img/lightbox-2x.jpg" },
  },
};

test("storefront mapping uses card/card_2x for product cards", () => {
  const card = resolveCardImage(baseImage as any);
  assert.equal(card.image, "https://img/card.jpg");
  assert.equal(card.image2x, "https://img/card-2x.jpg");
});

test("storefront mapping uses gallery thumb/main/lightbox variant keys for PDP", () => {
  const mapped = mapGallerySurfaceImages(baseImage as any);
  assert.equal(mapped.thumbUrl, "https://img/gallery-thumb.jpg");
  assert.equal(mapped.mainUrl, "https://img/gallery-main.jpg");
  assert.equal(mapped.main2xUrl, "https://img/gallery-main-2x.jpg");
  assert.equal(mapped.lightboxUrl, "https://img/lightbox.jpg");
  assert.equal(mapped.lightbox2xUrl, "https://img/lightbox-2x.jpg");
});

test("variant fallbacks resolve to original URLs when specific variants are missing", () => {
  const missing = {
    ...baseImage,
    variants: {},
  };
  const card = resolveCardImage(missing as any);
  const mapped = mapGallerySurfaceImages(missing as any);
  assert.equal(card.image, "https://img/original.jpg");
  assert.equal(mapped.thumbUrl, "https://img/original.jpg");
  assert.equal(mapped.mainUrl, "https://img/original.jpg");
  assert.equal(mapped.lightboxUrl, "https://img/original.jpg");
});

test("hover image falls back cleanly when card variant is missing", () => {
  const gallery = [{ ...baseImage, mediaAssetId: "img1", variants: {} }];
  const hover = resolveHoverImageUrl({
    primaryImageUrl: "https://img/another.jpg",
    hoverImageId: "img1",
    galleryImages: gallery as any,
  });
  assert.equal(hover, "https://img/original.jpg");
});
