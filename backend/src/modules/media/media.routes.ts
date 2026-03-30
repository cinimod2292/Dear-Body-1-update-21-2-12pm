import fs from "node:fs/promises";
import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { createUploadSchema, finalizeUploadSchema, mediaListQuerySchema, updateMediaAssetSchema } from "./media.schemas.js";
import { prepareUpload, resolveLocalPublicBaseUrl, resolveLocalUploadPath, resolvePublicUrlForStorageKey } from "./upload.service.js";
import { toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";

export async function mediaRoutes(app: FastifyInstance) {
  app.post(
    "/admin/media/uploads/prepare",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = createUploadSchema.parse(request.body);
      const prepared = await prepareUpload(body.filename, body.mimeType);
      request.log.info({
        uploadProvider: env.UPLOAD_PROVIDER,
        publicBaseUrl: env.PUBLIC_BASE_URL ?? null,
        resolvedLocalPublicBaseUrl: env.UPLOAD_PROVIDER === "s3" ? null : resolveLocalPublicBaseUrl(),
        storageKey: prepared.storageKey,
        uploadUrl: prepared.uploadUrl,
      }, "Prepared media upload");
      return reply.send({ data: prepared });
    },
  );

  app.post(
    "/admin/media/uploads/finalize",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = finalizeUploadSchema.parse(request.body);
      const resolvedPublicUrl = resolvePublicUrlForStorageKey(body.storageKey);

      if (env.UPLOAD_PROVIDER === "local") {
        const localPath = resolveLocalUploadPath(body.storageKey);
        request.log.info({
          storageKey: body.storageKey,
          localPath,
          resolvedPublicUrl,
          publicBaseUrl: env.PUBLIC_BASE_URL ?? null,
        }, "Finalizing local media upload");

        try {
          await fs.access(localPath);
        } catch {
          request.log.error({
            storageKey: body.storageKey,
            localPath,
            resolvedPublicUrl,
          }, "Finalize failed: local upload file missing");
          throw new AppError(422, "Uploaded file not found for storage key; upload may have failed or landed on a different runtime instance.", "MEDIA_UPLOAD_FILE_MISSING", {
            storageKey: body.storageKey,
          });
        }
      }

      const asset = await prisma.mediaAsset.create({
        data: {
          filename: body.storageKey.split("/").pop() ?? body.storageKey,
          mimeType: body.metadata?.mimeType as string ?? "application/octet-stream",
          byteSize: Number(body.metadata?.byteSize ?? 0),
          kind: body.kind ?? "FILE",
          storageKey: body.storageKey,
          publicUrl: resolvedPublicUrl,
          altText: body.altText,
          uploadedById: request.user.sub,
          metadata: body.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      request.log.info({
        mediaAssetId: asset.id,
        storageKey: asset.storageKey,
        publicUrl: asset.publicUrl,
      }, "Media upload finalized");
      return reply.send({ data: asset });
    },
  );

  app.get(
    "/admin/media/local-upload/diagnostics",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:read")] },
    async (request, reply) => {
      const query = request.query as { limit?: string };
      const limit = Math.min(Math.max(Number(query.limit ?? 200) || 200, 1), 500);
      const localBaseUrl = (() => {
        try {
          return resolveLocalPublicBaseUrl();
        } catch {
          return null;
        }
      })();

      const candidates = await prisma.mediaAsset.findMany({
        where: {
          OR: [
            { publicUrl: { contains: "/local-upload/", mode: "insensitive" } },
            { storageKey: { startsWith: "uploads/" } },
          ],
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, storageKey: true, publicUrl: true, createdAt: true },
      });

      const results = await Promise.all(candidates.map(async (asset) => {
        const localPath = resolveLocalUploadPath(asset.storageKey);
        const expectedPublicUrl = `${localBaseUrl ?? "<PUBLIC_BASE_URL_UNSET>"}/local-upload/${asset.storageKey}`;
        try {
          await fs.access(localPath);
          return { ...asset, localPath, expectedPublicUrl, fileExists: true };
        } catch {
          return { ...asset, localPath, expectedPublicUrl, fileExists: false };
        }
      }));

      const missing = results.filter((row) => !row.fileExists);
      request.log.info({
        checked: results.length,
        missing: missing.length,
      }, "Completed local-upload diagnostics");

      return reply.send({
        data: {
          checked: results.length,
          missing: missing.length,
          items: missing,
        },
      });
    },
  );

  app.get(
    "/admin/media",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:read")] },
    async (request, reply) => {
      const query = mediaListQuerySchema.parse(request.query);
      const { skip, take, orderBy } = toPrismaPagination(query);

      const where = {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.q ? {
            OR: [
              { filename: { contains: query.q, mode: "insensitive" as const } },
              { storageKey: { contains: query.q, mode: "insensitive" as const } },
              { publicUrl: { contains: query.q, mode: "insensitive" as const } },
              { altText: { contains: query.q, mode: "insensitive" as const } },
            ],
          } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.mediaAsset.findMany({ where, skip, take, orderBy }),
        prisma.mediaAsset.count({ where }),
      ]);

      return reply.send({ data: toPaginatedResponse(items, total, query) });
    },
  );

  app.get(
    "/admin/media/:mediaId",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:read")] },
    async (request, reply) => {
      const params = request.params as { mediaId: string };
      const asset = await prisma.mediaAsset.findUnique({
        where: { id: params.mediaId },
        include: {
          galleries: {
            select: {
              product: {
                select: { id: true, name: true },
              },
            },
            take: 5,
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: { galleries: true },
          },
        },
      });

      if (!asset) throw new AppError(404, "Media asset not found", "MEDIA_NOT_FOUND");

      return reply.send({
        data: {
          ...asset,
          usage: {
            galleryCount: asset._count.galleries,
            products: asset.galleries.map((entry) => entry.product),
          },
        },
      });
    },
  );

  app.patch(
    "/admin/media/:mediaId",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const params = request.params as { mediaId: string };
      const body = updateMediaAssetSchema.parse(request.body);

      const existing = await prisma.mediaAsset.findUnique({ where: { id: params.mediaId }, select: { id: true } });
      if (!existing) throw new AppError(404, "Media asset not found", "MEDIA_NOT_FOUND");

      const updated = await prisma.mediaAsset.update({
        where: { id: params.mediaId },
        data: {
          ...(body.filename !== undefined ? { filename: body.filename } : {}),
          ...(body.altText !== undefined ? { altText: body.altText || null } : {}),
        },
      });

      return reply.send({ data: updated });
    },
  );

  app.delete(
    "/admin/media/:mediaId",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const params = request.params as { mediaId: string };
      const asset = await prisma.mediaAsset.findUnique({
        where: { id: params.mediaId },
        include: { _count: { select: { galleries: true } } },
      });

      if (!asset) throw new AppError(404, "Media asset not found", "MEDIA_NOT_FOUND");

      if (asset._count.galleries > 0) {
        throw new AppError(
          409,
          "This image is currently attached to products and cannot be deleted until it is removed from those products.",
          "MEDIA_IN_USE",
          { galleryCount: asset._count.galleries },
        );
      }

      await prisma.mediaAsset.delete({ where: { id: params.mediaId } });
      return reply.status(204).send();
    },
  );
}
