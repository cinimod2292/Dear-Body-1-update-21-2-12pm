import test from "node:test";
import assert from "node:assert/strict";
import { extractLegacyImageUrls, planLegacyImageMigration } from "./legacy-image-migration.js";

test("canonical-only product remains unchanged", () => {
  const plan = planLegacyImageMigration({
    legacyUrls: [],
    canonicalMediaUrls: ["https://cdn/img1.jpg"],
  });
  assert.deepEqual(plan.toMigrate, []);
});

test("legacy-only product migrates all legacy urls", () => {
  const plan = planLegacyImageMigration({
    legacyUrls: ["https://legacy/1.jpg", "https://legacy/2.jpg"],
    canonicalMediaUrls: [],
  });
  assert.deepEqual(plan.toMigrate, ["https://legacy/1.jpg", "https://legacy/2.jpg"]);
});

test("mixed product migrates only missing urls and skips duplicates", () => {
  const plan = planLegacyImageMigration({
    legacyUrls: ["https://cdn/img1.jpg", "https://legacy/3.jpg"],
    canonicalMediaUrls: ["https://cdn/img1.jpg"],
  });
  assert.deepEqual(plan.toMigrate, ["https://legacy/3.jpg"]);
  assert.deepEqual(plan.duplicates, ["https://cdn/img1.jpg"]);
});

test("extractLegacyImageUrls reads json shortDescription and ignores invalid", () => {
  const urls = extractLegacyImageUrls('{"images":["https://legacy/1.jpg"],"image":"https://legacy/cover.jpg"}');
  assert.deepEqual(urls, ["https://legacy/1.jpg", "https://legacy/cover.jpg"]);
  assert.deepEqual(extractLegacyImageUrls("not-json"), []);
});
