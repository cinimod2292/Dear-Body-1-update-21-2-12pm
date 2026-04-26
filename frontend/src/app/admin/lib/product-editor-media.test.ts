import test from "node:test";
import assert from "node:assert/strict";
import { resolveBestMediaPreviewUrl, resolveSelectedEditorMediaAssets } from "./product-editor-media";

test("resolveSelectedEditorMediaAssets prefers canonical gallery media IDs", () => {
  const assets = resolveSelectedEditorMediaAssets({
    galleries: [{ mediaAssetId: "m1" }],
    mediaAssets: [{ id: "m1", filename: "Image 1", publicUrl: "https://cdn/original.jpg", mimeType: "image/jpeg" }],
  });

  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.id, "m1");
});

test("resolveSelectedEditorMediaAssets uses gallery embedded media when not present in paginated media list", () => {
  const assets = resolveSelectedEditorMediaAssets({
    galleries: [{ mediaAssetId: "m1", mediaAsset: { id: "m1", filename: "Embedded", publicUrl: "https://cdn/embedded.jpg", mimeType: "image/jpeg" } }],
    mediaAssets: [],
  });

  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.publicUrl, "https://cdn/embedded.jpg");
});

test("resolveBestMediaPreviewUrl prefers optimized variants over potentially broken original URL", () => {
  const url = resolveBestMediaPreviewUrl({
    id: "m1",
    filename: "Broken original",
    publicUrl: "https://private-signed/original.jpg",
    mimeType: "image/jpeg",
    variants: [
      { key: "thumb", publicUrl: "https://cdn/thumb.jpg" },
      { key: "card", publicUrl: "https://cdn/card.jpg" },
    ],
  });

  assert.equal(url, "https://cdn/card.jpg");
});

test("resolveSelectedEditorMediaAssets falls back to legacy image URLs when gallery rows are absent", () => {
  const assets = resolveSelectedEditorMediaAssets({
    galleries: [],
    mediaAssets: [],
    legacyImages: ["https://legacy/1.jpg", "https://legacy/2.jpg"],
  });

  assert.equal(assets.length, 2);
  assert.equal(assets[0]?.id, "legacy:0");
  assert.equal(assets[1]?.publicUrl, "https://legacy/2.jpg");
});
