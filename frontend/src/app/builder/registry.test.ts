import assert from "node:assert/strict";
import test from "node:test";
import { DEAR_BODY_SECTION_META } from "./registry.meta";

test("builder registry metadata includes required Dear Body section types", () => {
  assert.ok(DEAR_BODY_SECTION_META.hero_banner);
  assert.ok(DEAR_BODY_SECTION_META.featured_products);
  assert.ok(DEAR_BODY_SECTION_META.image_text);
  assert.ok(DEAR_BODY_SECTION_META.benefit_icons);
  assert.ok(DEAR_BODY_SECTION_META.promo_banner);
});
