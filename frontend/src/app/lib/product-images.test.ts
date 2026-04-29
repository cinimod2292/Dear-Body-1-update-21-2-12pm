import test from "node:test";
import assert from "node:assert/strict";
import {
  getCardImageSources,
  mapProductCardImageFields,
  getGalleryMainSources,
  getLightboxSources,
  getThumbImageSources,
  mapGallerySurfaceImages,
  PRODUCT_CARD_IMAGE_SIZES,
  resolveCardImage,
  resolveHoverImageUrl,
  normalizeProductImages,
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

test("ProductCard field mapping uses card-sized sources by default", () => {
  const hoverImage = {
    ...baseImage,
    mediaAssetId: "img2",
    url: "https://img/hover-original.jpg",
    variants: {
      ...baseImage.variants,
      card: { url: "https://img/hover-card.jpg" },
      card_2x: { url: "https://img/hover-card-2x.jpg" },
    },
  };
  const mapped = mapProductCardImageFields({
    primaryImage: baseImage as any,
    hoverImageId: "img2",
    galleryImages: [baseImage as any, hoverImage as any],
  });

  assert.equal(mapped.image, "https://img/card.jpg");
  assert.equal(mapped.image2x, "https://img/card-2x.jpg");
  assert.equal(mapped.hoverImage, "https://img/hover-card.jpg");
  assert.equal(mapped.hoverImage2x, "https://img/hover-card-2x.jpg");
});

test("ProductCard field mapping defaults hover image to second gallery image", () => {
  const second = {
    ...baseImage,
    mediaAssetId: "img2",
    url: "https://img/second-original.jpg",
    variants: {
      ...baseImage.variants,
      card: { url: "https://img/second-card.jpg" },
      card_2x: { url: "https://img/second-card-2x.jpg" },
    },
  };

  const mapped = mapProductCardImageFields({
    primaryImage: baseImage as any,
    galleryImages: [baseImage as any, second as any],
  });

  assert.equal(mapped.hoverImage, "https://img/second-card.jpg");
  assert.equal(mapped.hoverImage2x, "https://img/second-card-2x.jpg");
});

test("ProductCard hover image fallback handles one-or-zero images", () => {
  const singleImageMapped = mapProductCardImageFields({
    primaryImage: baseImage as any,
    galleryImages: [baseImage as any],
  });
  assert.equal(singleImageMapped.hoverImage, undefined);

  const noImageMapped = mapProductCardImageFields({
    primaryImage: undefined,
    galleryImages: [],
  });
  assert.equal(noImageMapped.image, "");
  assert.equal(noImageMapped.hoverImage, undefined);
});

test("Product card responsive sizes favor realistic rendered card widths", () => {
  assert.equal(
    PRODUCT_CARD_IMAGE_SIZES,
    "(min-width: 1280px) 280px, (min-width: 1024px) 29vw, (min-width: 640px) 44vw, 92vw",
  );
});


test("normalizeProductImages handles Cloudflare object-shaped variants", () => {
  const images = normalizeProductImages([{
    mediaAssetId: "img-object",
    mediaAsset: {
      publicUrl: "https://img/original.jpg",
      variants: {
        thumbnail: { url: "https://img/thumb.jpg", width: 160, height: 160 },
        card: { url: "https://img/card.jpg", width: 480, height: 480 },
      },
    },
  }] as any);

  assert.equal(images.length, 1);
  assert.equal(images[0]?.variants?.thumbnail?.url, "https://img/thumb.jpg");
  assert.equal(images[0]?.variants?.card?.url, "https://img/card.jpg");
});

test("normalizeProductImages handles missing arrays safely", () => {
  const images = normalizeProductImages([{
    mediaAssetId: "img-missing",
    mediaAsset: {
      publicUrl: "https://img/original.jpg",
      variants: undefined,
    },
  }] as any);

  assert.equal(images.length, 1);
  assert.deepEqual(images[0]?.variants, {});
});
