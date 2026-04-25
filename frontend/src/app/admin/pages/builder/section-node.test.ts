import test from "node:test";
import assert from "node:assert/strict";
import { extractSelectedNodeId, resolveInspectableSection, resolveSectionTypeFromNode } from "./section-node";

const baseMeta = {
  displayName: "X",
  description: "Y",
  icon: "Z",
  removable: true,
  movable: true,
  duplicatable: true,
};

const registry = {
  hero_banner: { ...baseMeta, editableSchema: { title: { type: "text", label: "Title" } } },
  featured_products: { ...baseMeta, editableSchema: { title: { type: "text", label: "Title" } } },
  image_text: { ...baseMeta, editableSchema: { title: { type: "text", label: "Title" } } },
  benefit_icons: { ...baseMeta, editableSchema: { title: { type: "text", label: "Title" } } },
  promo_banner: { ...baseMeta, editableSchema: { text: { type: "text", label: "Text" } } },
} as const;

test("resolves section type from custom.sectionType", () => {
  assert.equal(resolveSectionTypeFromNode({ custom: { sectionType: "hero_banner" } }), "hero_banner");
});

test("resolves section type from displayName fallback", () => {
  assert.equal(resolveSectionTypeFromNode({ displayName: "Featured Products" }), "featured_products");
});

test("resolves existing loaded node shape via data.type.resolvedName", () => {
  const resolved = resolveInspectableSection("hero-main", {
    data: {
      type: { resolvedName: "HeroCraftSection" },
      props: { title: "Dare to be Vibrant" },
    },
  }, registry as any);

  assert.equal(resolved?.sectionType, "hero_banner");
  assert.equal(resolved?.nodeProps.title, "Dare to be Vibrant");
});

test("returns null for unknown nodes", () => {
  assert.equal(resolveInspectableSection("x", { data: { displayName: "Unknown Block" } }, registry as any), null);
});

test("extractSelectedNodeId supports string, array and set-like selection payloads", () => {
  assert.equal(extractSelectedNodeId("hero-main"), "hero-main");
  assert.equal(extractSelectedNodeId(["featured-main"]), "featured-main");
  assert.equal(extractSelectedNodeId(new Set(["promo-main"])), "promo-main");
});
