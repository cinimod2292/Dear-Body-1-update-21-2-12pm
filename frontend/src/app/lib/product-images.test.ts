import test from "node:test";
import assert from "node:assert/strict";
import {
  getCardImageSources,
  getGalleryMainSources,
  getLightboxSources,
  getThumbImageSources,
  mapGallerySurfaceImages,
  resolveCardImage,
  resolveHoverImageUrl,
} from "./product-images";

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

test("getCardImageSources uses card/card_2x for product cards", () => {
  const card = getCardImageSources(baseImage as any);
  assert.equal(card?.src, "https://img/card.jpg");
  assert.equal(card?.srcSet, "https://img/card.jpg 1x, https://img/card-2x.jpg 2x");

  const resolved = resolveCardImage(baseImage as any);
  assert.equal(resolved.image, "https://img/card.jpg");
  assert.equal(resolved.image2x, "https://img/card-2x.jpg");
});

test("card fallback order is card -> gallery_main -> thumb -> original", () => {
  const noCard = { ...baseImage, variants: { ...baseImage.variants, card: undefined, card_2x: undefined } };
  assert.equal(getCardImageSources(noCard as any)?.src, "https://img/gallery-main.jpg");

  const noCardNoMain = { ...baseImage, variants: { ...baseImage.variants, card: undefined, card_2x: undefined, gallery_main: undefined } };
  assert.equal(getCardImageSources(noCardNoMain as any)?.src, "https://img/thumb.jpg");

  const onlyOriginal = { ...baseImage, variants: {} };
  assert.equal(getCardImageSources(onlyOriginal as any)?.src, "https://img/original.jpg");
});

test("surface helpers map PDP thumb/main/lightbox variants correctly", () => {
  const thumb = getThumbImageSources(baseImage as any);
  const main = getGalleryMainSources(baseImage as any);
  const lightbox = getLightboxSources(baseImage as any);

  assert.equal(thumb?.src, "https://img/gallery-thumb.jpg");
  assert.equal(main?.src, "https://img/gallery-main.jpg");
  assert.equal(main?.srcSet, "https://img/gallery-main.jpg 1x, https://img/gallery-main-2x.jpg 2x");
  assert.equal(lightbox?.src, "https://img/lightbox.jpg");
  assert.equal(lightbox?.srcSet, "https://img/lightbox.jpg 1x, https://img/lightbox-2x.jpg 2x");

  const mapped = mapGallerySurfaceImages(baseImage as any);
  assert.equal(mapped.thumbUrl, "https://img/gallery-thumb.jpg");
  assert.equal(mapped.mainUrl, "https://img/gallery-main.jpg");
  assert.equal(mapped.main2xUrl, "https://img/gallery-main-2x.jpg");
  assert.equal(mapped.lightboxUrl, "https://img/lightbox.jpg");
  assert.equal(mapped.lightbox2xUrl, "https://img/lightbox-2x.jpg");
});

test("hover image uses card strategy and falls back only when variants are absent", () => {
  const gallery = [{ ...baseImage, mediaAssetId: "img1" }];
  const hover = resolveHoverImageUrl({
    primaryImageUrl: "https://img/another.jpg",
    hoverImageId: "img1",
    galleryImages: gallery as any,
  });
  assert.equal(hover, "https://img/card.jpg");

  const noVariantsHover = resolveHoverImageUrl({
    primaryImageUrl: "https://img/another.jpg",
    hoverImageId: "img1",
    galleryImages: [{ ...baseImage, mediaAssetId: "img1", variants: {} }] as any,
  });
  assert.equal(noVariantsHover, "https://img/original.jpg");
});
