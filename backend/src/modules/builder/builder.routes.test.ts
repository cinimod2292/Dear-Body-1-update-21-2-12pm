import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { builderRoutes, createHeroImageUploadHandler } from "./builder.routes.js";

test("hero upload route is registered (not 404)", async () => {
  const app = Fastify();
  await app.register(multipart);
  (app as any).decorate("verifyAdmin", async () => undefined);
  (app as any).decorate("requirePermission", () => async () => undefined);
  await app.register(async (api) => {
    await api.register(builderRoutes);
  }, { prefix: "/api" });

  const response = await app.inject({
    method: "POST",
    url: "/api/admin/builder/home/hero-image",
  });

  assert.notEqual(response.statusCode, 404);
  await app.close();
});

test("hero upload handler reuses media upload storage config/service and does not require publicBaseUrl", async () => {
  let wrote = false;
  const handler = createHeroImageUploadHandler({
    resolveUploadConfig: async () => ({
      provider: "cloudflare-r2",
      bucket: "media-bucket",
      endpoint: "https://abc.r2.cloudflarestorage.com",
      publicBaseUrl: undefined,
      accessKeyId: "key",
      secretAccessKey: "secret",
      signedUrlTtlSeconds: 900,
      forcePathStyle: true,
      region: "auto",
    }),
    writeStorageObjectBuffer: async () => { wrote = true; },
    resolvePublicUrlForStorageKey: (storageKey) => `https://api.example.com/api/media/public/${storageKey}`,
    createMediaAsset: async ({ data }: any) => ({ id: "asset_1", altText: data.altText }),
  } as any);

  const request = {
    file: async () => ({
      mimetype: "image/jpeg",
      filename: "hero.jpg",
      toBuffer: async () => Buffer.from("img"),
      fields: { alt: { value: "Hero" } },
    }),
  } as any;
  let payload: any = null;
  const reply = { send: (value: any) => { payload = value; return value; } } as any;

  await handler(request, reply);
  assert.equal(wrote, true);
  assert.equal(payload?.data?.imageAssetId, "asset_1");
  assert.match(String(payload?.data?.imageUrl ?? ""), /\/api\/media\/public\/uploads\/hero\//);
});
