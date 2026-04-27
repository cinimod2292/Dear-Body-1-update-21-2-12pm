import fs from "node:fs/promises";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { assignMediaToProductSchema, createUploadSchema, finalizeUploadSchema, mediaByIdsSchema, mediaListQuerySchema, regenerateVariantsBatchSchema, runMediaBackfillSchema, unlinkMediaFromProductSchema, updateMediaAssetSchema } from "./media.schemas.js";
import { assertS3ObjectExists, createS3DownloadUrl, prepareUpload, resolveLocalPublicBaseUrl, resolveLocalUploadPath, resolvePublicUrlForStorageKey, resolveUploadConfig } from "./upload.service.js";
import { toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";
import { generateMediaVariantsForAsset } from "./media-variants.js";
import { runMediaVariantsBackfill } from "./media-variants-backfill.service.js";
import { regenerateVariantsForMediaIds } from "./media-variants-batch.js";
import { toPickerMediaItem } from "./media-picker.js";

type FinalizeVariantGenerationResult = {
  variantsPending: boolean;
  variantErrors: string[];
};

type SingleAssetVariantResponse = {
  mediaId: string;
  generated: number;
  skipped: number;
  failed: number;
  variantErrors: string[];
  variantKeys: string[];
  variants: Array<{ key: string; publicUrl: string | null; width: number | null; height: number | null; mimeType: string | null }>;
  variantsPending: boolean;
};

type SingleAssetVariantRecord = { key: string; storageKey: string; width: number | null; height: number | null; mimeType: string | null };

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function __testOnly__regenerateSingleAssetVariants(
  assetId: string,
  deps: {
    force?: boolean;
    timeoutMs?: number;
    runGeneration: (mediaId: string, options: { force?: boolean }) => Promise<{ generated?: number; skipped?: number; failed?: number; errors?: string[] }>;
    loadVariantRecords: (mediaId: string) => Promise<{ mediaId: string; variants: SingleAssetVariantRecord[] } | null>;
    resolveVariantPublicUrl: (storageKey: string) => string;
  },
): Promise<SingleAssetVariantResponse> {
  const timeoutMs = Math.max(500, deps.timeoutMs ?? 6000);
  const generationPromise = deps.runGeneration(assetId, { force: deps.force })
    .then((generation) => ({ status: "ok" as const, generation }))
    .catch((error) => ({ status: "error" as const, error }));
  const timeoutPromise = new Promise<{ status: "timeout" }>((resolve) => {
    setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
  });
  const generationResult = await Promise.race([generationPromise, timeoutPromise]);

  const loaded = await deps.loadVariantRecords(assetId);
  if (!loaded) throw new AppError(404, "Media asset not found", "MEDIA_NOT_FOUND");
  const variants = loaded.variants.map((variant) => ({
    key: variant.key,
    publicUrl: deps.resolveVariantPublicUrl(variant.storageKey),
    width: variant.width ?? null,
    height: variant.height ?? null,
    mimeType: variant.mimeType ?? null,
  }));

  return {
    mediaId: loaded.mediaId,
    generated: generationResult.status === "ok" ? (generationResult.generation.generated ?? 0) : 0,
    skipped: generationResult.status === "ok" ? (generationResult.generation.skipped ?? 0) : 0,
    failed: generationResult.status === "ok" ? (generationResult.generation.failed ?? 0) : generationResult.status === "error" ? 1 : 0,
    variantErrors: generationResult.status === "ok"
      ? (Array.isArray(generationResult.generation.errors) ? generationResult.generation.errors : [])
      : generationResult.status === "error"
        ? [toErrorMessage(generationResult.error)]
        : [`Variant generation still running after ${timeoutMs}ms. Please retry in a few seconds.`],
    variantKeys: variants.map((variant) => variant.key),
    variants,
    variantsPending: generationResult.status === "timeout",
  };
}

export async function __testOnly__attemptVariantGenerationOnFinalize(
  generate: () => Promise<unknown>,
  logger: Pick<FastifyInstance["log"], "info" | "warn" | "error">,
  options?: { timeoutMs?: number; mediaAssetId?: string },
): Promise<FinalizeVariantGenerationResult> {
  const timeoutMs = Math.max(250, options?.timeoutMs ?? 4000);
  const mediaAssetId = options?.mediaAssetId ?? "unknown";

  const generationPromise = generate()
    .then((generation) => ({ status: "ok" as const, generation }))
    .catch((error) => ({ status: "error" as const, error }));
  const timeoutPromise = new Promise<{ status: "timeout" }>((resolve) => {
    setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
  });

  const outcome = await Promise.race([generationPromise, timeoutPromise]);

  if (outcome.status === "ok") {
    const generation = outcome.generation as { failed?: number; errors?: string[] } | undefined;
    const variantErrors = Array.isArray(generation?.errors) ? generation.errors : [];
    if ((generation?.failed ?? 0) > 0 || variantErrors.length > 0) {
      logger.warn({ mediaAssetId, generation, variantErrors }, "Media variant generation completed with errors on finalize");
      return { variantsPending: false, variantErrors };
    }
    logger.info({ mediaAssetId, generation: outcome.generation }, "Generated media variants on finalize");
    return { variantsPending: false, variantErrors: [] };
  }
  if (outcome.status === "error") {
    const message = toErrorMessage(outcome.error);
    logger.error({ mediaAssetId, err: outcome.error, message }, "Failed to generate media variants on finalize");
    return { variantsPending: false, variantErrors: [message] };
  }

  logger.warn({ mediaAssetId, timeoutMs }, "Media variants still processing after finalize timeout");
  generationPromise
    .then((result) => {
      if (result.status === "ok") {
        logger.info({ mediaAssetId, generation: result.generation }, "Generated media variants after finalize response");
        return;
      }
      logger.error({ mediaAssetId, err: result.error, message: toErrorMessage(result.error) }, "Media variants failed after finalize response");
    })
    .catch((error) => {
      logger.error({ mediaAssetId, err: error, message: toErrorMessage(error) }, "Unexpected variant generation rejection");
    });
  return { variantsPending: true, variantErrors: [] };
}

export async function mediaRoutes(app: FastifyInstance) {
  let backfillInProgress = false;
  const executeBackfill = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const body = runMediaBackfillSchema.parse(request.body ?? {});
    if (backfillInProgress) {
      return reply.status(409).send({
        status: "running",
        message: "A media backfill run is already in progress",
      });
    }

    backfillInProgress = true;
    const mode = body.assetId ? "asset" : body.productId ? "product" : "all";

    request.log.info({
      mode,
      assetId: body.assetId ?? null,
      productId: body.productId ?? null,
      force: body.force,
      actorUserId: request.user.sub,
    }, "Media variant backfill started");

    try {
      const result = await runMediaVariantsBackfill({
        all: !body.assetId && !body.productId,
        productId: body.productId,
        assetId: body.assetId,
        force: body.force,
        maxAssets: body.maxAssets ?? (mode === "all" ? 100 : undefined),
      }, (message, meta) => {
        request.log.info({ ...meta }, message);
      });

      const succeeded = result.assetsProcessed - result.failures.length;
      request.log.info({
        mode: result.mode,
        assetsProcessed: result.assetsProcessed,
        succeededAssets: succeeded,
        failedAssets: result.failures.length,
        generated: result.generated,
        skipped: result.skipped,
        failed: result.failed,
        sharpAvailable: result.sharpAvailable,
        truncated: result.truncated,
        force: body.force,
        assetId: body.assetId ?? null,
        productId: body.productId ?? null,
      }, "Media variant backfill completed");

      return reply.send({
        status: "ok",
        mode: result.mode,
        processed: result.assetsProcessed,
        created: result.generated,
        failed: result.failed,
        message: "Media variant backfill completed",
        succeededAssets: succeeded,
        failedAssets: result.failures.length,
        force: body.force,
        assetId: body.assetId ?? null,
        productId: body.productId ?? null,
        sharpAvailable: result.sharpAvailable,
        truncated: result.truncated,
      });
    } catch (error) {
      request.log.error({ err: error, mode, force: body.force, assetId: body.assetId ?? null, productId: body.productId ?? null }, "Media variant backfill failed");
      throw error;
    } finally {
      backfillInProgress = false;
    }
  };

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
      if (env.MEDIA_BACKFILL_TOKEN) {
        const token = request.headers["x-internal-token"];
        const suppliedToken = Array.isArray(token) ? token[0] : token;
        if (suppliedToken !== env.MEDIA_BACKFILL_TOKEN) {
          return reply.status(403).send({ error: { message: "Invalid internal token" } });
        }
      } else {
        request.log.warn("MEDIA_BACKFILL_TOKEN is not configured; falling back to authenticated admin-only access");
      }

      return executeBackfill(request, reply);
    },
  );

  app.post(
    "/admin/media/run-backfill-ui",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      return executeBackfill(request, reply);
    },
  );

  app.post(
    "/admin/media/uploads/prepare",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = createUploadSchema.parse(request.body);
      if (body.kind === "IMAGE" && !body.mimeType.toLowerCase().startsWith("image/")) {
        throw new AppError(422, "Invalid image file type", "INVALID_IMAGE_MIME_TYPE");
      }
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
      request.log.info({
        storageKey: body.storageKey,
        kind: body.kind ?? null,
        mimeType: body.metadata?.mimeType ?? null,
        byteSize: body.metadata?.byteSize ?? null,
      }, "Finalize upload payload received");
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
        kind: asset.kind,
      }, "Media upload finalized");

      let variantStatus: FinalizeVariantGenerationResult = { variantsPending: false, variantErrors: [] };
      if (asset.kind === "IMAGE") {
        request.log.info({ mediaAssetId: asset.id }, "Starting media variant generation on finalize");
        variantStatus = await __testOnly__attemptVariantGenerationOnFinalize(
          () => generateMediaVariantsForAsset(asset.id),
          request.log,
          { mediaAssetId: asset.id },
        );
      }
      const assetWithVariants = await prisma.mediaAsset.findUnique({
        where: { id: asset.id },
        include: { variants: true },
      });
      request.log.info({
        mediaAssetId: asset.id,
        variantsPending: variantStatus.variantsPending,
        variantErrors: variantStatus.variantErrors,
      }, "Finalize upload response path");
      return reply.send({
        data: assetWithVariants ?? asset,
        variantsPending: variantStatus.variantsPending,
        variantErrors: variantStatus.variantErrors,
      });
    },
  );

  if (process.env.NODE_ENV !== "production") {
    app.get(
      "/admin/media/assets/:assetId/debug",
      { preHandler: [app.verifyAdmin, app.requirePermission("media:read")] },
      async (request, reply) => {
        const { assetId } = request.params as { assetId: string };
        const asset = await prisma.mediaAsset.findUnique({
          where: { id: assetId },
          include: { variants: true },
        });
        if (!asset) return reply.status(404).send({ error: { message: "Media asset not found" } });

        const variants = asset.variants.map((variant) => ({
          key: variant.key,
          publicUrl: variant.publicUrl,
          storageKey: variant.storageKey,
          byteSize: variant.byteSize,
        }));

        const payload = {
          assetId: asset.id,
          originalPublicUrl: asset.publicUrl,
          originalByteSize: asset.byteSize,
          variants,
          hasHeroDesktop: variants.some((variant) => variant.key === "hero_desktop"),
          hasCard: variants.some((variant) => variant.key === "card"),
          hasThumb: variants.some((variant) => variant.key === "thumb"),
        };
        request.log.info(payload, "Admin media debug payload");
        return reply.send({ data: payload });
      },
    );
  }

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
      const includeVariants = query.view === "picker"
        ? {
            variants: {
              where: { key: { in: ["thumb", "card", "gallery_thumb"] } },
              select: { key: true, storageKey: true, publicUrl: true },
            },
          }
        : { variants: true };

      const [items, total] = await Promise.all([
        prisma.mediaAsset.findMany({ where, skip, take, orderBy, include: includeVariants as any }),
        prisma.mediaAsset.count({ where }),
      ]);

      const normalizedItems = query.view === "picker"
        ? items.map((item) => toPickerMediaItem(item as any, cfg))
        : items.map((item) => ({
            ...item,
            publicUrl: resolvePublicUrlForStorageKey(item.storageKey, cfg),
            variants: item.variants.map((variant: any) => ({
              ...variant,
              publicUrl: resolvePublicUrlForStorageKey(variant.storageKey, cfg),
            })),
          }));
      return reply.send({ data: toPaginatedResponse(normalizedItems as any[], total, query) });
    },
  );

  app.post(
    "/admin/media/by-ids",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:read")] },
    async (request, reply) => {
      const body = mediaByIdsSchema.parse(request.body);
      const cfg = await resolveUploadConfig();

      const include = body.view === "picker"
        ? {
            variants: {
              where: { key: { in: ["thumb", "card", "gallery_thumb"] } },
              select: { key: true, storageKey: true, publicUrl: true },
            },
          }
        : { variants: true };

      const items = await prisma.mediaAsset.findMany({
        where: { id: { in: body.ids } },
        include: include as any,
      });

      const idOrder = new Map(body.ids.map((id, index) => [id, index]));
      items.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

      const data = body.view === "picker"
        ? items.map((item) => toPickerMediaItem(item as any, cfg))
        : items.map((item) => ({
            ...item,
            publicUrl: resolvePublicUrlForStorageKey(item.storageKey, cfg),
            variants: item.variants.map((variant: any) => ({
              ...variant,
              publicUrl: resolvePublicUrlForStorageKey(variant.storageKey, cfg),
            })),
          }));

      return reply.send({ data });
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
    "/admin/media/assets/:assetId/regenerate-variants",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const { assetId } = request.params as { assetId: string };
      const query = request.query as { force?: string };
      const cfg = await resolveUploadConfig();
      const response = await __testOnly__regenerateSingleAssetVariants(assetId, {
        force: query.force === "true",
        timeoutMs: 6000,
        runGeneration: (mediaId, options) => generateMediaVariantsForAsset(mediaId, options),
        loadVariantRecords: async (mediaId) => {
          const asset = await prisma.mediaAsset.findUnique({
            where: { id: mediaId },
            select: {
              id: true,
              variants: { select: { key: true, storageKey: true, width: true, height: true, mimeType: true }, orderBy: { key: "asc" } },
            },
          });
          if (!asset) return null;
          return { mediaId: asset.id, variants: asset.variants };
        },
        resolveVariantPublicUrl: (storageKey) => resolvePublicUrlForStorageKey(storageKey, cfg),
      });
      return reply.send({ data: response });
    },
  );

  app.post(
    "/admin/media/:mediaId/regenerate-variants",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const { mediaId } = request.params as { mediaId: string };
      return reply.redirect(`/admin/media/assets/${mediaId}/regenerate-variants`, 307);
    },
  );

  app.post(
    "/admin/media/variants/regenerate",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = regenerateVariantsBatchSchema.parse(request.body);
      const result = await regenerateVariantsForMediaIds(body.mediaIds, { concurrency: body.concurrency });
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
