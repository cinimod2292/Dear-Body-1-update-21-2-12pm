import test from "node:test";
import assert from "node:assert/strict";
import { toPickerMediaItem } from "./media-picker.js";

test("toPickerMediaItem prefers thumb/card variants for thumbnail URL", () => {
  const cfg: any = { provider: "local" };
  const item = toPickerMediaItem({
    id: "m1",
    kind: "IMAGE",
    filename: "example.jpg",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    storageKey: "uploads/original.jpg",
    variants: [
      { key: "card", storageKey: "variants/m1/card.webp" },
      { key: "thumb", storageKey: "variants/m1/thumb.webp" },
    ],
  }, cfg);

  assert.match(item.thumbnailUrl, /variants\/m1\/thumb\.webp$/);
  assert.match(item.displayUrl, /uploads\/original\.jpg$/);
});

test("toPickerMediaItem exposes mimeType so the picker can guard non-image previews", () => {
  const cfg: any = { provider: "local" };
  const item = toPickerMediaItem({
    id: "m2",
    kind: "IMAGE",
    filename: "example.png",
    mimeType: "image/png",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    storageKey: "uploads/example.png",
    variants: [],
  }, cfg);

  assert.equal(item.mimeType, "image/png");
});
