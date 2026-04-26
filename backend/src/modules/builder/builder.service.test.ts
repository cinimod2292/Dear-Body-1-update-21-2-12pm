import test from "node:test";
import assert from "node:assert/strict";
import { __testOnly__choosePreferredImageVariantUrl } from "./builder.service.js";

test("hero variant preference chooses hero_desktop over original", () => {
  const url = __testOnly__choosePreferredImageVariantUrl({
    variants: [
      { key: "card", storageKey: "variants/asset/card.webp" },
      { key: "hero_desktop", storageKey: "variants/asset/hero_desktop.webp" },
    ],
    fallbackStorageKey: "uploads/original.jpg",
    isHero: true,
  }, (storageKey) => `https://cdn.test/${storageKey}`);

  assert.equal(url, "https://cdn.test/variants/asset/hero_desktop.webp");
});

test("hero variant preference avoids oversized original when card/thumb exist", () => {
  const url = __testOnly__choosePreferredImageVariantUrl({
    variants: [
      { key: "thumb", storageKey: "variants/asset/thumb.webp" },
      { key: "card", storageKey: "variants/asset/card.webp" },
    ],
    fallbackStorageKey: "uploads/huge-original.jpg",
    isHero: true,
  }, (storageKey) => `https://cdn.test/${storageKey}`);

  assert.equal(url, "https://cdn.test/variants/asset/card.webp");
});
