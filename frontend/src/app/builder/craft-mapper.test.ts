import test from "node:test";
import assert from "node:assert/strict";
import { craftNodesToPageContent, duplicateSectionInContent, pageContentToCraftNodes } from "./craft-mapper";

test("craft mapper round-trips supported section types", () => {
  const content = {
    sections: [
      { id: "hero_1", type: "hero_banner", enabled: true, props: { title: "Hello" } },
      { id: "promo_1", type: "promo_banner", enabled: false, props: { text: "Promo" } },
    ],
  } as const;

  const serialized = pageContentToCraftNodes(content as any);
  const restored = craftNodesToPageContent(serialized);

  assert.equal(restored.sections.length, 2);
  assert.equal(restored.sections[0]?.type, "hero_banner");
  assert.equal(restored.sections[1]?.enabled, false);
});

test("craft mapper skips unknown component nodes safely", () => {
  const restored = craftNodesToPageContent({
    ROOT: {
      type: { resolvedName: "BuilderCanvas" },
      isCanvas: true,
      props: {},
      displayName: "root",
      custom: {},
      hidden: false,
      nodes: ["abc"],
      linkedNodes: {},
    },
    abc: {
      type: { resolvedName: "UnknownSection" },
      isCanvas: false,
      props: {},
      displayName: "Unknown",
      custom: {},
      hidden: false,
      parent: "ROOT",
      nodes: [],
      linkedNodes: {},
    },
  } as any);

  assert.equal(restored.sections.length, 0);
});

test("duplicateSectionInContent inserts copy after source", () => {
  const duplicated = duplicateSectionInContent({
    sections: [{ id: "hero_1", type: "hero_banner", enabled: true, props: { title: "A" } }],
  }, "hero_1");

  assert.equal(duplicated.sections.length, 2);
  assert.equal(duplicated.sections[1]?.type, "hero_banner");
  assert.notEqual(duplicated.sections[1]?.id, "hero_1");
});

test("pageContentToCraftNodes does not preserve original hero upload URL in node props", () => {
  const serialized = pageContentToCraftNodes({
    sections: [{ id: "hero_1", type: "hero_banner", enabled: true, props: { imageUrl: "https://cdn.example.com/local-upload/uploads/a/huge-source.jpg" } }],
  });

  assert.equal((serialized.hero_1 as any)?.props?.imageUrl, null);
});

test("pageContentToCraftNodes preserves safe hero variant URL in node props", () => {
  const serialized = pageContentToCraftNodes({
    sections: [{ id: "hero_1", type: "hero_banner", enabled: true, props: { imageUrl: "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a/hero.jpg" } }],
  });

  assert.equal((serialized.hero_1 as any)?.props?.imageUrl, "https://media.dearbody.co.za/cdn-cgi/image/width=1920/https://media.dearbody.co.za/uploads/a/hero.jpg");
});

test("draft save/load round trip preserves safe hero imageUrl", () => {
  const input = {
    sections: [{ id: "hero_1", type: "hero_banner", enabled: true, props: { imageUrl: "https://media.dearbody.co.za/cdn-cgi/image/width=480/https://media.dearbody.co.za/uploads/a/card.jpg" } }],
  } as any;

  const serialized = pageContentToCraftNodes(input);
  const restored = craftNodesToPageContent(serialized);

  assert.equal(restored.sections[0]?.props?.imageUrl, "https://media.dearbody.co.za/cdn-cgi/image/width=480/https://media.dearbody.co.za/uploads/a/card.jpg");
});
