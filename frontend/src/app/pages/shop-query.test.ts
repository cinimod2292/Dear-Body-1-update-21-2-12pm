import test from "node:test";
import assert from "node:assert/strict";
import { ALL_PRODUCTS_CATEGORY, getShopCategory, setShopCategory } from "./shop-query";

test("reads the selected category from the current shop URL", () => {
  assert.equal(getShopCategory(new URLSearchParams("category=Body+Lotion")), "Body Lotion");
  assert.equal(getShopCategory(new URLSearchParams()), ALL_PRODUCTS_CATEGORY);
});

test("updates the category without mutating or dropping other shop filters", () => {
  const current = new URLSearchParams("search=vanilla&category=Body+Spray");
  const next = setShopCategory(current, "Body Lotion");

  assert.equal(current.get("category"), "Body Spray");
  assert.equal(next.get("category"), "Body Lotion");
  assert.equal(next.get("search"), "vanilla");
});

test("removes the category parameter when all products is selected", () => {
  const next = setShopCategory(
    new URLSearchParams("search=vanilla&category=Body+Spray"),
    ALL_PRODUCTS_CATEGORY,
  );

  assert.equal(next.has("category"), false);
  assert.equal(next.get("search"), "vanilla");
});
