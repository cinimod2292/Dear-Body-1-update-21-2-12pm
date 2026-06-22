import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../lib/errors.js";
import { normalizeHoverImageId, withResolvedProductMediaUrls } from "./product-images.js";

test("normalizeHoverImageId accepts null and valid configured gallery ids", () => {
  assert.equal(
    normalizeHoverImageId({
      hoverImageId: "img_2",
      incomingGallery: [
        { mediaAssetId: "img_1", position: 0 },
        { mediaAssetId: "img_2", position: 1 },
      ],
    }),
    "img_2",
  );

  assert.equal(
    normalizeHoverImageId({
      hoverImageId: null,
      incomingGallery: [{ mediaAssetId: "img_1", position: 0 }],
    }),
    null,
  );
});

test("normalizeHoverImageId rejects hover images outside product gallery", () => {
  assert.throws(
    () => normalizeHoverImageId({
      hoverImageId: "img_3",
      incomingGallery: [{ mediaAssetId: "img_1", position: 0 }],
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "PRODUCT_HOVER_IMAGE_INVALID");
      return true;
    },
  );
});

test("normalizeHoverImageId auto-clears stale hover image when gallery no longer contains it", () => {
  assert.equal(
    normalizeHoverImageId({
      incomingGallery: [{ mediaAssetId: "img_1", position: 0 }],
      existingGallery: [{ mediaAssetId: "img_1" }, { mediaAssetId: "img_2" }],
      existingHoverImageId: "img_2",
    }),
    null,
  );
});

test("withResolvedProductMediaUrls resolves both gallery and hover URLs", () => {
  const resolved = withResolvedProductMediaUrls({
    galleries: [{ mediaAsset: { id: "img_1", filename: "1", mimeType: "image/jpeg", storageKey: "gallery-key" } }],
    hoverImage: { id: "img_2", filename: "2", mimeType: "image/jpeg", storageKey: "hover-key" },
  }, (key) => `https://cdn.example/${key}`);

  assert.equal((resolved.galleries?.[0]?.mediaAsset as any)?.publicUrl, "https://cdn.example/gallery-key");
  assert.equal((resolved.hoverImage as any)?.publicUrl, "https://cdn.example/hover-key");
});

test("withResolvedProductMediaUrls keeps the external publicUrl for remote-import assets", () => {
  const resolved = withResolvedProductMediaUrls({
    galleries: [{
      mediaAsset: {
        id: "img_1",
        filename: "imported.png",
        mimeType: "image/png",
        storageKey: "remote-import/2026-02-03/abc-imported.png",
        publicUrl: "https://legacy-cdn.example.com/imported.png",
      },
    }],
    hoverImage: null,
  }, (key) => `https://cdn.example/${key}`);

  const asset = resolved.galleries?.[0]?.mediaAsset as any;
  // Must not be rewritten to the bucket key (which 404s and trips ORB on <img>).
  assert.equal(asset?.publicUrl, "https://legacy-cdn.example.com/imported.png");
  assert.equal(asset?.variants?.original?.url, "https://legacy-cdn.example.com/imported.png");
  assert.equal(asset?.variants?.card?.url, "https://legacy-cdn.example.com/imported.png");
});
