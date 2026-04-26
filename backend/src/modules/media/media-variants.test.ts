import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  MEDIA_VARIANT_SPECS,
  resolveVariantOutputMimeType,
  __resetMediaVariantDepsForTests,
  __resetMediaVariantTransformerForTests,
  __setMediaVariantDepsForTests,
  __setMediaVariantTransformerForTests,
  generateMediaVariantsForAsset,
} from "./media-variants.js";

beforeEach(() => {
  __resetMediaVariantTransformerForTests();
  __resetMediaVariantDepsForTests();
});

afterEach(() => {
  __resetMediaVariantTransformerForTests();
  __resetMediaVariantDepsForTests();
});

test("generateMediaVariantsForAsset transforms images and writes variant metadata", async () => {
  const writes: Array<{ key: string; mimeType: string; size: number }> = [];
  const upserts: any[] = [];

  __setMediaVariantDepsForTests({
    findAssetWithVariants: async () => ({
      id: "asset_1",
      kind: "IMAGE",
      storageKey: "uploads/x/source.png",
      mimeType: "image/png",
      variants: [],
    }),
    upsertVariant: async (args) => {
      upserts.push(args);
      return args.create;
    },
    resolveUploadConfig: async () => ({ provider: "local" } as any),
    readStorageObjectBuffer: async () => Buffer.from("original-bytes"),
    resolvePublicUrlForStorageKey: (storageKey: string) => `https://cdn.test/${storageKey}`,
    writeStorageObjectBuffer: async (storageKey: string, buffer: Buffer, mimeType: string) => {
      writes.push({ key: storageKey, mimeType, size: buffer.byteLength });
    },
  });

  __setMediaVariantTransformerForTests(async ({ targetMaxWidth, targetMaxHeight, sourceMimeType }) => ({
    buffer: Buffer.alloc(Math.max(16, Math.floor((targetMaxWidth + targetMaxHeight) / 4))),
    width: Math.min(targetMaxWidth, 1200),
    height: Math.min(targetMaxHeight, 800),
    mimeType: sourceMimeType === "image/png" ? "image/png" : "image/webp",
  }));

  const result = await generateMediaVariantsForAsset("asset_1");
  assert.deepEqual(result, { generated: MEDIA_VARIANT_SPECS.length, skipped: 0, failed: 0 });
  assert.equal(writes.length, MEDIA_VARIANT_SPECS.length);
  assert.equal(upserts.length, MEDIA_VARIANT_SPECS.length);
  assert.match(writes[0]!.key, /^variants\/asset_1\//);
  assert.equal(upserts[0]!.create.mimeType, "image/png");
  assert.ok(upserts[0]!.create.byteSize > 0);
});

test("generateMediaVariantsForAsset does not upscale small sources and is idempotent without force", async () => {
  const upserts: any[] = [];

  __setMediaVariantDepsForTests({
    findAssetWithVariants: async () => ({
      id: "asset_small",
      kind: "IMAGE",
      storageKey: "uploads/x/small.jpg",
      mimeType: "image/jpeg",
      variants: [{ key: "thumb" }, { key: "card" }],
    }),
    upsertVariant: async (args) => {
      upserts.push(args);
      return args.create;
    },
    resolveUploadConfig: async () => ({ provider: "local" } as any),
    readStorageObjectBuffer: async () => Buffer.from("small-original"),
    resolvePublicUrlForStorageKey: (storageKey: string) => `https://cdn.test/${storageKey}`,
    writeStorageObjectBuffer: async () => {},
  });

  __setMediaVariantTransformerForTests(async ({ targetMaxWidth, targetMaxHeight }) => ({
    buffer: Buffer.from("tiny"),
    width: Math.min(100, targetMaxWidth),
    height: Math.min(80, targetMaxHeight),
    mimeType: "image/webp",
  }));

  const result = await generateMediaVariantsForAsset("asset_small");
  assert.equal(result.skipped, 2);
  assert.equal(result.generated, MEDIA_VARIANT_SPECS.length - 2);
  assert.ok(upserts.every((entry) => entry.create.width <= 100));
  assert.ok(upserts.every((entry) => entry.create.height <= 80));
});

test("generateMediaVariantsForAsset supports forced regeneration and partial failures safely", async () => {
  let writes = 0;

  __setMediaVariantDepsForTests({
    findAssetWithVariants: async () => ({
      id: "asset_force",
      kind: "IMAGE",
      storageKey: "uploads/x/photo.webp",
      mimeType: "image/webp",
      variants: [{ key: "thumb" }],
    }),
    upsertVariant: async (args) => args.create,
    resolveUploadConfig: async () => ({ provider: "local" } as any),
    readStorageObjectBuffer: async () => Buffer.from("webp-original"),
    resolvePublicUrlForStorageKey: (storageKey: string) => `https://cdn.test/${storageKey}`,
    writeStorageObjectBuffer: async () => {
      writes += 1;
    },
  });

  __setMediaVariantTransformerForTests(async ({ variantKey }) => {
    if (variantKey === "card") {
      throw new Error("corrupt");
    }
    return {
      buffer: Buffer.from("ok"),
      width: 900,
      height: 600,
      mimeType: "image/webp",
    };
  });

  const result = await generateMediaVariantsForAsset("asset_force", { force: true });
  assert.equal(result.failed, 1);
  assert.equal(result.generated, MEDIA_VARIANT_SPECS.length - 1);
  assert.equal(writes, MEDIA_VARIANT_SPECS.length - 1);
});

test("resolveVariantOutputMimeType preserves transparency only when truly needed", () => {
  assert.equal(resolveVariantOutputMimeType({ sourceMimeType: "image/jpeg", hasTransparentPixels: false }), "image/webp");
  assert.equal(resolveVariantOutputMimeType({ sourceMimeType: "image/png", hasTransparentPixels: false }), "image/webp");
  assert.equal(resolveVariantOutputMimeType({ sourceMimeType: "image/png", hasTransparentPixels: true }), "image/png");
  assert.equal(resolveVariantOutputMimeType({ sourceMimeType: "image/webp", hasTransparentPixels: false }), "image/webp");
  assert.equal(resolveVariantOutputMimeType({ sourceMimeType: "image/webp", hasTransparentPixels: true }), "image/webp");
});

test("hero variant specs target optimized storefront sizes", () => {
  const heroDesktop = MEDIA_VARIANT_SPECS.find((spec) => spec.key === "hero_desktop");
  const heroMobile = MEDIA_VARIANT_SPECS.find((spec) => spec.key === "hero_mobile");
  assert.equal(heroDesktop?.maxWidth, 1920);
  assert.equal(heroMobile?.maxWidth, 900);
});
