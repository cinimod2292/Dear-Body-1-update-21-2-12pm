import test from "node:test";
import assert from "node:assert/strict";
import { createUploadSchema, regenerateVariantsBatchSchema } from "./media.schemas.js";

test("createUploadSchema enforces maximum upload byte size", () => {
  const valid = createUploadSchema.parse({
    filename: "product.jpg",
    mimeType: "image/jpeg",
    byteSize: 1024,
    kind: "IMAGE",
  });
  assert.equal(valid.kind, "IMAGE");

  assert.throws(() => {
    createUploadSchema.parse({
      filename: "too-large.jpg",
      mimeType: "image/jpeg",
      byteSize: 50 * 1024 * 1024 + 1,
      kind: "IMAGE",
    });
  });

  assert.throws(() => {
    createUploadSchema.parse({
      filename: "not-image.txt",
      mimeType: "text/plain",
      byteSize: 512,
      kind: "IMAGE",
    });
  });
});

test("regenerateVariantsBatchSchema validates media ids and concurrency", () => {
  const parsed = regenerateVariantsBatchSchema.parse({
    mediaIds: ["ckf3w9j4b0000q4m1z3zv0a1b", "ckf3w9j4b0000q4m1z3zv0a1c"],
    concurrency: 3,
  });
  assert.equal(parsed.mediaIds.length, 2);
  assert.equal(parsed.concurrency, 3);

  assert.throws(() => regenerateVariantsBatchSchema.parse({ mediaIds: [] }));
  assert.throws(() => regenerateVariantsBatchSchema.parse({ mediaIds: ["ckf3w9j4b0000q4m1z3zv0a1b"], concurrency: 9 }));
});
