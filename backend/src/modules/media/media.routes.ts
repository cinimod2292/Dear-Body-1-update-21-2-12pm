import fs from "node:fs/promises";
import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { assignMediaToProductSchema, createUploadSchema, finalizeUploadSchema, mediaListQuerySchema, runMediaBackfillSchema, unlinkMediaFromProductSchema, updateMediaAssetSchema } from "./media.schemas.js";
import { assertS3ObjectExists, createS3DownloadUrl, prepareUpload, resolveLocalPublicBaseUrl, resolveLocalUploadPath, resolvePublicUrlForStorageKey, resolveUploadConfig } from "./upload.service.js";
import { toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";
import { generateMediaVariantsForAsset } from "./media-variants.js";
import { runMediaVariantsBackfill } from "./media-variants-backfill.service.js";

export async function mediaRoutes(app: FastifyInstance) {
  let backfillInProgress = false;
  let backfillRunId = 0;

  app.get("/media/public/*", async (request, reply) => {
    const storageKey = String((request.params as Record<string, string>)["*"] ?? "").trim();
    if (!storageKey) return reply.status(400).send({ error: { message: "Missing storage key" } });
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    const cfg = await resolveUploadConfig();
    if (cfg.provider === "local") {
      return reply.redirect(`${resolveLocalPublicBaseUrl()}/local-upload/${storageKey}`);
    }
    const downloadUrl = await createS3DownloadUrl(storageKey, cfg);
    return reply.redirect(downloadUrl);
  });

  app.post(
    "/admin/media/run-backfill",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = runMediaBackfillSchema.parse(request.body ?? {});
      const token = request.headers["x-internal-token"];
      const suppliedToken = Array.isArray(token) ? token[0] : token;
      if (env.MEDIA_BACKFILL_TOKEN && suppliedToken !== env.MEDIA_BACKFILL_TOKEN) {
        return reply.status(403).send({ error: { message: "Invalid internal token" } });
      }

      if (backfillInProgress) {
        return reply.status(409).send({
          status: "running",
          message: "A media backfill run is already in progress",
        });
      }

      backfillInProgress = true;
      backfillRunId += 1;
      const runId = backfillRunId;
      const mode = body.assetId ? "asset" : body.productId ? "product" : "all";

      request.log.info({
        runId,
        mode,
        assetId: body.assetId ?? null,
        productId: body.productId ?? null,
        force: body.force,
        actorUserId: request.user.sub,
      }, "Media variant backfill started");

      setImmediate(() => {
        runMediaVariantsBackfill({
          all: !body.assetId && !body.productId,
          productId: body.productId,
          assetId: body.assetId,
          force: body.force,
        }, (message, meta) => {
          request.log.info({ runId, ...meta }, message);
        })
          .then((result) => {
            request.log.info({
              runId,
              mode: result.mode,
              assetsProcessed: result.assetsProcessed,
              generated: result.generated,
              skipped: result.skipped,
              failed: result.failed,
              sharpAvailable: result.sharpAvailable,
              failureCount: result.failures.length,
            }, "Media variant backfill completed");
          })
          .catch((error) => {
            request.log.error({ runId, err: error }, "Media variant backfill failed");
          })
          .finally(() => {
            backfillInProgress = false;
          });
      });

      return reply.send({
        status: "started",
        mode,
        details: {
          runId,
          force: body.force,
          assetId: body.assetId ?? null,
          productId: body.productId ?? null,
        },
      });
    },
  );

  app.post(
    "/admin/media/uploads/prepare",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = createUploadSchema.parse(request.body);
      const cfg = await resolveUploadConfig();
      const prepared = await prepareUpload(body.filename, body.mimeType);
      request.log.info({
        uploadProvider: cfg.provider,
        publicBaseUrl: env.PUBLIC_BASE_URL ?? null,
        resolvedLocalPublicBaseUrl: cfg.provider === "local" ? resolveLocalPublicBaseUrl() : null,
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
      const cfg = await resolveUploadConfig();
      const resolvedPublicUrl = resolvePublicUrlForStorageKey(body.storageKey, cfg);

      if (cfg.provider === "local") {
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

      if (cfg.provider === "s3" || cfg.provider === "cloudflare-r2") {
        try {
          await assertS3ObjectExists(body.storageKey);
        } catch (error) {
          request.log.error({
            storageKey: body.storageKey,
            err: error,
          }, "Finalize failed: uploaded object not found in S3");
          throw new AppError(422, "Uploaded object not found in persistent storage.", "MEDIA_UPLOAD_FILE_MISSING", {
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

      if (asset.kind === "IMAGE") {
        generateMediaVariantsForAsset(asset.id).catch((error) => {
          request.log.error({ err: error, mediaAssetId: asset.id }, "Failed to generate media variants");
        });
      }
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

      const cfg = await resolveUploadConfig();
      const [items, total] = await Promise.all([
        prisma.mediaAsset.findMany({ where, skip, take, orderBy, include: { variants: true } }),
        prisma.mediaAsset.count({ where }),
      ]);

      const normalizedItems = items.map((item) => ({
        ...item,
        publicUrl: resolvePublicUrlForStorageKey(item.storageKey, cfg),
        variants: item.variants.map((variant) => ({
          ...variant,
          publicUrl: resolvePublicUrlForStorageKey(variant.storageKey, cfg),
        })),
      }));
      return reply.send({ data: toPaginatedResponse(normalizedItems, total, query) });
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
                select: {
                  id: true,
                  name: true,
                  variants: { select: { sku: true }, orderBy: { createdAt: "asc" }, take: 1 },
                },
              },
            },
            take: 5,
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: { galleries: true },
          },
          variants: true,
        },
      });

      if (!asset) throw new AppError(404, "Media asset not found", "MEDIA_NOT_FOUND");

      const cfg = await resolveUploadConfig();
      return reply.send({
        data: {
          ...asset,
          publicUrl: resolvePublicUrlForStorageKey(asset.storageKey, cfg),
          variants: asset.variants.map((variant) => ({
            ...variant,
            publicUrl: resolvePublicUrlForStorageKey(variant.storageKey, cfg),
          })),
          usage: {
            galleryCount: asset._count.galleries,
            products: asset.galleries.map((entry) => ({
              id: entry.product.id,
              name: entry.product.name,
              sku: entry.product.variants[0]?.sku ?? null,
            })),
          },
        },
      });
    },
  );

  app.post(
    "/admin/media/:mediaId/regenerate-variants",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const { mediaId } = request.params as { mediaId: string };
      const query = request.query as { force?: string };
      const result = await generateMediaVariantsForAsset(mediaId, { force: query.force === "true" });
      return reply.send({ data: result });
    },
  );

  app.post(
    "/admin/media/:mediaId/assign-product",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const { mediaId } = request.params as { mediaId: string };
      const body = assignMediaToProductSchema.parse(request.body);

      const [asset, variant] = await Promise.all([
        prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { id: true } }),
        prisma.productVariant.findUnique({
          where: { sku: body.sku },
          include: { product: { select: { id: true, name: true } } },
        }),
      ]);
      if (!asset) throw new AppError(404, "Media asset not found", "MEDIA_NOT_FOUND");
      if (!variant) throw new AppError(404, `SKU "${body.sku}" not found`, "SKU_NOT_FOUND");

      if (body.replaceExisting) {
        await prisma.productGalleryImage.deleteMany({
          where: {
            mediaAssetId: mediaId,
            productId: { not: variant.product.id },
          },
        });
      }

      const maxPosition = await prisma.productGalleryImage.aggregate({
        where: { productId: variant.product.id },
        _max: { position: true },
      });
      const position = (maxPosition._max.position ?? -1) + 1;

      await prisma.productGalleryImage.upsert({
        where: {
          productId_mediaAssetId: {
            productId: variant.product.id,
            mediaAssetId: mediaId,
          },
        },
        update: {},
        create: {
          productId: variant.product.id,
          mediaAssetId: mediaId,
          position,
        },
      });

      request.log.info({
        mediaId,
        sku: body.sku,
        productId: variant.product.id,
        replaceExisting: body.replaceExisting,
      }, "Assigned media to product");

      return reply.send({
        data: {
          mediaId,
          sku: body.sku,
          product: variant.product,
        },
      });
    },
  );

  app.post(
    "/admin/media/:mediaId/unlink-product",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const { mediaId } = request.params as { mediaId: string };
      const body = unlinkMediaFromProductSchema.parse(request.body);

      const variant = await prisma.productVariant.findUnique({
        where: { sku: body.sku },
        select: { productId: true },
      });
      if (!variant) throw new AppError(404, `SKU "${body.sku}" not found`, "SKU_NOT_FOUND");

      const removed = await prisma.productGalleryImage.deleteMany({
        where: {
          mediaAssetId: mediaId,
          productId: variant.productId,
        },
      });

      request.log.info({
        mediaId,
        sku: body.sku,
        removed: removed.count,
      }, "Unlinked media from product");

      return reply.send({ data: { removed: removed.count } });
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
