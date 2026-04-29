import test from "node:test";
import assert from "node:assert/strict";
import { canAssignSelectedAsset, pickOptimizedHeroVariant, resolveNextSelectedMediaId, selectedAssetLabel, validateHeroAssignmentAsset } from "./media-assignment";

test("resolveNextSelectedMediaId selects clicked media id", () => {
  assert.equal(resolveNextSelectedMediaId(null, "asset_1"), "asset_1");
});

test("selectedAssetLabel returns readable label", () => {
  assert.equal(selectedAssetLabel({ id: "asset_2", filename: "hero.jpg" } as any), "hero.jpg (asset_2)");
  assert.equal(selectedAssetLabel(null), "none");
});

test("canAssignSelectedAsset requires selected asset and idle saving state", () => {
  assert.equal(canAssignSelectedAsset(null, false), false);
  assert.equal(canAssignSelectedAsset({ id: "asset_3" } as any, true), false);
  assert.equal(canAssignSelectedAsset({ id: "asset_3" } as any, false), true);
});

test("pickOptimizedHeroVariant prefers hero/card variants and ignores original", () => {
  const picked = pickOptimizedHeroVariant({
    id: "asset_hero",
    kind: "IMAGE",
    publicUrl: "https://cdn.example.com/uploads/original-41mb.jpg",
    variants: [
      { key: "thumb", publicUrl: "https://cdn.example.com/variants/thumb.webp" },
      { key: "card", publicUrl: "https://cdn.example.com/variants/card.webp" },
    ],
  } as any);
  assert.equal(picked?.key, "card");
  assert.equal(picked?.url, "https://cdn.example.com/variants/card.webp");
});

test("validateHeroAssignmentAsset rejects original-only image assets", () => {
  const result = validateHeroAssignmentAsset({
    id: "asset_original_only",
    filename: "huge-original.jpg",
    kind: "IMAGE",
    publicUrl: "https://cdn.example.com/uploads/huge-original.jpg",
    variants: [],
  } as any);
  assert.equal(result.ok, false);
  assert.match((result as any).reason, /cloudflare delivery variants/i);
});
