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

export async function builderRoutes(app: FastifyInstance) {
  app.post(
    "/admin/builder/home/hero-image",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const cfg = await resolveUploadConfig();
      if (cfg.provider === "cloudflare-r2" && (!cfg.publicBaseUrl || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey)) {
        throw new AppError(422, "Cloudflare/R2 storage is not fully configured.", "HERO_STORAGE_NOT_CONFIGURED");
      }
      const part = await request.file();
      if (!part) throw new AppError(400, "Image file is required.", "HERO_IMAGE_REQUIRED");
      if (!String(part.mimetype ?? "").startsWith("image/")) throw new AppError(400, "Only image files are allowed.", "HERO_IMAGE_INVALID_TYPE");
      const buffer = await part.toBuffer();
      const storageKey = sanitizeStorageKey(`uploads/hero/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${(part.filename || "hero").replace(/[^a-zA-Z0-9._-]/g, "-")}`);
      await writeStorageObjectBuffer(storageKey, buffer, part.mimetype || "application/octet-stream", cfg);
      const originalUrl = resolvePublicUrlForStorageKey(storageKey, cfg);
      if (!originalUrl) throw new AppError(422, "Hero image upload did not return a public URL.", "HERO_IMAGE_UPLOAD_FAILED");
      const asset = await prisma.mediaAsset.create({
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
      });
      return reply.send({ data: { imageAssetId: asset.id, imageUrl: originalUrl, imageMobileUrl: originalUrl, originalUrl, alt: asset.altText ?? "", storageKey, storageProvider: cfg.provider } });
    },
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
