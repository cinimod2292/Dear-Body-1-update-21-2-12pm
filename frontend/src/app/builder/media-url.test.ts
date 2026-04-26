import test from "node:test";
import assert from "node:assert/strict";
import { isSafeImageUrl } from "./media-url";

test("isSafeImageUrl allows relative and https URLs", () => {
  assert.equal(isSafeImageUrl("/uploads/a.jpg"), true);
  assert.equal(isSafeImageUrl("https://cdn.example/a.jpg"), true);
});

test("isSafeImageUrl rejects unsafe URL schemes", () => {
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("http://example.com/a.jpg"), false);
});
