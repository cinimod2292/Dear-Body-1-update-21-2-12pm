import test from "node:test";
import assert from "node:assert/strict";
import {
  createSection,
  duplicateSection,
  groupForSectionType,
  hasUnsavedChanges,
  moveSection,
  removeSection,
  updateSection,
} from "./editor-state";

const baseSections = [
  { id: "hero_1", type: "hero_banner", enabled: true, props: { title: "Hero" } },
  { id: "promo_1", type: "promo_banner", enabled: true, props: { text: "Promo" } },
] as const;

test("createSection clones default props", () => {
  const defaults = { title: "A" };
  const section = createSection("hero_banner", defaults);
  defaults.title = "B";
  assert.equal(section.props.title, "A");
});

test("moveSection reorders by direction", () => {
  const moved = moveSection([...baseSections], 0, 1);
  assert.equal(moved[0]?.id, "promo_1");
  assert.equal(moved[1]?.id, "hero_1");
});

test("duplicateSection inserts a cloned section after source", () => {
  const duplicated = duplicateSection([...baseSections], "hero_1");
  assert.equal(duplicated.length, 3);
  assert.equal(duplicated[1]?.type, "hero_banner");
  assert.notEqual(duplicated[1]?.id, "hero_1");
});

test("removeSection deletes selected section", () => {
  const next = removeSection([...baseSections], "promo_1");
  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, "hero_1");
});

test("updateSection updates enabled state", () => {
  const next = updateSection([...baseSections], "hero_1", (section) => ({ ...section, enabled: false }));
  assert.equal(next[0]?.enabled, false);
});

test("hasUnsavedChanges compares snapshots", () => {
  assert.equal(hasUnsavedChanges({ sections: [...baseSections] as any }, { sections: [...baseSections] as any }), false);
  assert.equal(hasUnsavedChanges({ sections: [...baseSections, { id: "x", type: "promo_banner", enabled: true, props: {} }] as any }, { sections: [...baseSections] as any }), true);
});

test("groupForSectionType returns requested groups", () => {
  assert.equal(groupForSectionType("hero_banner"), "Hero");
  assert.equal(groupForSectionType("featured_products"), "Products");
  assert.equal(groupForSectionType("image_text"), "Content");
  assert.equal(groupForSectionType("benefit_icons"), "Trust/Benefits");
  assert.equal(groupForSectionType("promo_banner"), "Promotions");
});
