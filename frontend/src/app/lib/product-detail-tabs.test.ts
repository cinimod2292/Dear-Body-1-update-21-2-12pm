import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductDetailTabs } from "./product-detail-tabs";

test("resolveProductDetailTabs returns all tabs when every field has content", () => {
  const tabs = resolveProductDetailTabs({
    description: "A lovely body wash",
    ingredients: "Water, glycerin",
    howToUse: "Apply daily",
  });
  assert.deepEqual(tabs.map((t) => t.key), ["description", "ingredients", "howToUse"]);
});

test("resolveProductDetailTabs hides empty, whitespace-only, and missing fields", () => {
  const tabs = resolveProductDetailTabs({
    description: "Just a description",
    ingredients: "   ",
    howToUse: null,
  });
  assert.deepEqual(tabs.map((t) => t.key), ["description"]);
});

test("resolveProductDetailTabs returns no tabs when nothing is filled in", () => {
  const tabs = resolveProductDetailTabs({ description: "", ingredients: undefined, howToUse: "" });
  assert.equal(tabs.length, 0);
});

test("resolveProductDetailTabs can surface ingredients/how-to-use without a description", () => {
  const tabs = resolveProductDetailTabs({ description: "", ingredients: "Water", howToUse: "Rinse" });
  assert.deepEqual(tabs.map((t) => t.key), ["ingredients", "howToUse"]);
});
