import test from "node:test";
import assert from "node:assert/strict";
import { normalizeVariants, variantKeys } from "../lib/media-variants";
import { removeSection } from "./builder/editor-state";
import { pageContentToCraftNodes } from "../../builder/craft-mapper";
import { normalizeLoadContent } from "./builder/load-normalize";

test("page builder media normalization handles Cloudflare contract object variants", () => {
  const cloudflareContractVariants = {
    thumbnail: { url: "https://media.example.com/cdn-cgi/image/width=160/https://media.example.com/uploads/a.jpg" },
    card: { url: "https://media.example.com/cdn-cgi/image/width=480/https://media.example.com/uploads/a.jpg" },
    heroDesktop: { url: "https://media.example.com/cdn-cgi/image/width=1920/https://media.example.com/uploads/a.jpg" },
    heroMobile: { url: "https://media.example.com/cdn-cgi/image/width=900/https://media.example.com/uploads/a.jpg" },
  };

  const list = normalizeVariants(cloudflareContractVariants);
  const filtered = list.filter((entry) => Boolean(entry.url));
  assert.ok(filtered.length >= 1);
  assert.ok(variantKeys(cloudflareContractVariants).includes("heroDesktop"));
});

test("builder section mutation filter path is safe for object-shaped sections", () => {
  const sectionsObject = {
    a: { id: "a", type: "hero_banner", enabled: true, props: {} },
    b: { id: "b", type: "promo_banner", enabled: true, props: {} },
  } as any;

  const next = removeSection(sectionsObject, "a");
  assert.equal(Array.isArray(next), true);
  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, "b");
});

test("AdminBuilderHome load normalization accepts object sections and object variants without crashing", () => {
  const payload = {
    sections: {
      a: {
        id: "a",
        type: "hero_banner",
        enabled: true,
        props: {
          imageUrl: "https://media.example.com/cdn-cgi/image/width=1920/https://media.example.com/uploads/a.jpg",
          variants: {
            heroDesktop: { url: "https://media.example.com/cdn-cgi/image/width=1920/https://media.example.com/uploads/a.jpg" },
          },
        },
      },
    },
  } as any;

  const normalized = normalizeLoadContent(payload);
  assert.equal(Array.isArray(normalized.sections), true);
  assert.equal(normalized.sections.length, 1);
  const variantList = normalizeVariants((normalized.sections[0] as any)?.props?.variants);
  assert.equal(Array.isArray(variantList), true);
  assert.equal(variantList.length > 0, true);
  assert.doesNotThrow(() => pageContentToCraftNodes(normalized));
});
