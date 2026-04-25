import test from "node:test";
import assert from "node:assert/strict";
import { MAX_IMAGE_UPLOAD_BYTES, removeUploadedProductFromMissingList, validateProductImageFiles } from "./missing-product-images";

test("validateProductImageFiles accepts only image files within size limits", () => {
  const good = { name: "photo.jpg", type: "image/jpeg", size: 1024 } as File;
  assert.equal(validateProductImageFiles([good]), null);

  const wrongType = { name: "notes.txt", type: "text/plain", size: 512 } as File;
  assert.match(validateProductImageFiles([wrongType]) ?? "", /Only image files are allowed/);

  const tooBig = { name: "huge.png", type: "image/png", size: MAX_IMAGE_UPLOAD_BYTES + 1 } as File;
  assert.match(validateProductImageFiles([tooBig]) ?? "", /50MB limit/);
});

test("removeUploadedProductFromMissingList removes only the uploaded product", () => {
  const products = [
    { id: "p1", name: "A", slug: "a" },
    { id: "p2", name: "B", slug: "b" },
  ];

  const next = removeUploadedProductFromMissingList(products, "p1");
  assert.deepEqual(next, [{ id: "p2", name: "B", slug: "b" }]);
});
