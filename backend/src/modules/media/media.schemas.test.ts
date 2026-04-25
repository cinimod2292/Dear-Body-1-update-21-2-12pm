import test from "node:test";
import assert from "node:assert/strict";
import { createUploadSchema } from "./media.schemas.js";

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
});
