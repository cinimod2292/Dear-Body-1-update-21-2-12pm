import test from "node:test";
import assert from "node:assert/strict";
import { buildSectionList, resolveNodeSectionType } from "./section-tree";

test("resolveNodeSectionType prefers explicit custom.sectionType", () => {
  const sectionType = resolveNodeSectionType({
    type: { resolvedName: "HeroCraftSection" },
    custom: { sectionType: "promo_banner" },
  } as any);

  assert.equal(sectionType, "promo_banner");
});

test("buildSectionList preserves root order and maps resolved names", () => {
  const sections = buildSectionList({
    ROOT: { nodes: ["b", "a"] } as any,
    a: { type: { resolvedName: "HeroCraftSection" }, props: { sectionId: "hero_1", enabled: true } } as any,
    b: { type: { resolvedName: "FeaturedProductsCraftSection" }, props: { enabled: false } } as any,
  } as any);

  assert.equal(sections.length, 2);
  assert.equal(sections[0].sectionType, "featured_products");
  assert.equal(sections[0].enabled, false);
  assert.equal(sections[1].sectionType, "hero_banner");
  assert.equal(sections[1].sectionId, "hero_1");
});
