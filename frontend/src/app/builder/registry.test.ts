import assert from "node:assert/strict";
import test from "node:test";
import { dearBodySectionRegistry } from "./registry";

test("builder registry includes required Dear Body section types", () => {
  assert.ok(dearBodySectionRegistry.hero_banner);
  assert.ok(dearBodySectionRegistry.featured_products);
  assert.ok(dearBodySectionRegistry.image_text);
  assert.ok(dearBodySectionRegistry.benefit_icons);
  assert.ok(dearBodySectionRegistry.promo_banner);
});
