import test from "node:test";
import assert from "node:assert/strict";
import { SECTION_PRESETS } from "./presets";

test("section presets include all required section families", () => {
  const types = new Set(SECTION_PRESETS.map((preset) => preset.sectionType));
  assert.equal(types.has("hero_banner"), true);
  assert.equal(types.has("featured_products"), true);
  assert.equal(types.has("image_text"), true);
  assert.equal(types.has("benefit_icons"), true);
  assert.equal(types.has("promo_banner"), true);
});

test("section presets contain names and descriptions", () => {
  for (const preset of SECTION_PRESETS) {
    assert.ok(preset.name.length > 0);
    assert.ok(preset.description.length > 0);
    assert.ok(typeof preset.defaultProps === "object");
  }
});
