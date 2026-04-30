import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { resolvePublicUrlForStorageKey, resolveUploadConfig, sanitizeStorageKey, writeStorageObjectBuffer } from "../media/upload.service.js";
import {
  discardBuilderDraft,
  getAdminBuilderPage,
  getStoreBuilderPage,
  listBuilderPages,
  publishBuilderDraft,
  updateBuilderDraft,
} from "./builder.service.js";

type HeroUploadDeps = {
  resolveUploadConfig: typeof resolveUploadConfig;
  writeStorageObjectBuffer: typeof writeStorageObjectBuffer;
  resolvePublicUrlForStorageKey: typeof resolvePublicUrlForStorageKey;
  createMediaAsset: typeof prisma.mediaAsset.create;
  logger?: Pick<FastifyInstance["log"], "warn">;
};

export function createHeroImageUploadHandler(deps: HeroUploadDeps) {
  return async (request: any, reply: any) => {
    const cfg = await deps.resolveUploadConfig();
    const part = await request.file();
    if (!part) throw new AppError(400, "Image file is required.", "HERO_IMAGE_REQUIRED");
    if (!String(part.mimetype ?? "").startsWith("image/")) throw new AppError(400, "Only image files are allowed.", "HERO_IMAGE_INVALID_TYPE");
    const buffer = await part.toBuffer();
    const storageKey = sanitizeStorageKey(`uploads/hero/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${(part.filename || "hero").replace(/[^a-zA-Z0-9._-]/g, "-")}`);
    try {
      await deps.writeStorageObjectBuffer(storageKey, buffer, part.mimetype || "application/octet-stream", cfg);
    } catch (error) {
      const hasCredMessage = error instanceof Error && /bucket|access key|secret|region/i.test(error.message);
      if (hasCredMessage) {
        deps.logger?.warn?.({
          provider: cfg.provider,
          bucketConfigured: Boolean(cfg.bucket),
          endpointConfigured: Boolean(cfg.endpoint),
          publicBaseUrlConfigured: Boolean(cfg.publicBaseUrl),
          accessKeyConfigured: Boolean(cfg.accessKeyId),
          secretConfigured: Boolean(cfg.secretAccessKey),
          regionConfigured: Boolean(cfg.region),
        }, "Hero upload storage configuration missing required keys");
      }
      throw error;
    }
    const originalUrl = deps.resolvePublicUrlForStorageKey(storageKey, cfg);
    if (!originalUrl) throw new AppError(422, "Hero image upload did not return a public URL.", "HERO_IMAGE_UPLOAD_FAILED");
    const asset = await deps.createMediaAsset({
      data: {
        filename: part.filename || "hero-image",
        kind: "IMAGE",
        mimeType: part.mimetype || "application/octet-stream",
        byteSize: buffer.length,
        storageKey,
        publicUrl: originalUrl,
        altText: String((part.fields?.alt as any)?.value ?? ""),
        metadata: { source: "builder-home-hero" },
      },
    } as any);
    return reply.send({ data: { imageAssetId: asset.id, imageUrl: originalUrl, imageMobileUrl: originalUrl, originalUrl, alt: asset.altText ?? "", storageKey, storageProvider: cfg.provider } });
  };
}

export async function builderRoutes(app: FastifyInstance) {
  app.post(
    "/admin/builder/home/hero-image",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    createHeroImageUploadHandler({ resolveUploadConfig, writeStorageObjectBuffer, resolvePublicUrlForStorageKey, createMediaAsset: prisma.mediaAsset.create.bind(prisma.mediaAsset), logger: app.log }),
  );
  app.get(
    "/admin/builder/pages",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (_request, reply) => reply.send({ data: await listBuilderPages() }),
  );

  app.get(
    "/admin/builder/pages/:pageKey",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      return reply.send({ data: await getAdminBuilderPage(pageKey) });
    },
  );

  app.put(
    "/admin/builder/pages/:pageKey/draft",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      const actorUserId = (request.user as { sub?: string } | undefined)?.sub ?? null;
      return reply.send({ data: await updateBuilderDraft(pageKey, request.body, actorUserId) });
    },
  );

  app.post(
    "/admin/builder/pages/:pageKey/publish",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      const actorUserId = (request.user as { sub?: string } | undefined)?.sub ?? null;
      return reply.send({ data: await publishBuilderDraft(pageKey, actorUserId) });
    },
  );

  app.post(
    "/admin/builder/pages/:pageKey/discard-draft",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const { pageKey } = request.params as { pageKey: string };
      const actorUserId = (request.user as { sub?: string } | undefined)?.sub ?? null;
      return reply.send({ data: await discardBuilderDraft(pageKey, actorUserId) });
    },
  );

  app.get("/store/builder/pages/:pageKey", async (request, reply) => {
    const { pageKey } = request.params as { pageKey: string };
    const page = await getStoreBuilderPage(pageKey);
    if (!page) return reply.send({ data: null });
    reply.header("Cache-Control", "no-store, max-age=0");
    return reply.send({ data: page });
  });
}
