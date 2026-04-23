import test from "node:test";
import assert from "node:assert/strict";
import type { ProductDetailImage } from "../lib/product-detail-images";
import { deriveGalleryImages } from "../lib/product-detail-images";

const baseProduct = {
  images: ["https://img/image-1.jpg", "https://img/image-2.jpg"],
  image: "https://img/original.jpg",
};

test("deriveGalleryImages prioritizes galleryImages when present", () => {
  const derived = deriveGalleryImages({
    ...baseProduct,
    galleryImages: [{ url: "https://img/gallery-main.jpg", thumbUrl: "https://img/gallery-thumb.jpg" } satisfies ProductDetailImage],
  });

  assert.equal(derived.length, 1);
  assert.equal(derived[0]?.url, "https://img/gallery-main.jpg");
  assert.equal(derived[0]?.thumbUrl, "https://img/gallery-thumb.jpg");
});

test("deriveGalleryImages falls back to product.images", () => {
  const derived = deriveGalleryImages({ ...baseProduct, galleryImages: undefined });
  assert.equal(derived.length, 2);
  assert.equal(derived[0]?.url, "https://img/image-1.jpg");
});

test("deriveGalleryImages falls back to primary image and handles null product", () => {
  const withNoImages = deriveGalleryImages({ ...baseProduct, galleryImages: undefined, images: [] });
  assert.equal(withNoImages.length, 1);
  assert.equal(withNoImages[0]?.url, "https://img/original.jpg");

  const empty = deriveGalleryImages(null);
  assert.deepEqual(empty, []);
});
