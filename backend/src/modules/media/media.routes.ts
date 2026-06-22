import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { assignMediaToProductSchema, createUploadSchema, finalizeUploadSchema, mediaByIdsSchema, mediaListQuerySchema, regenerateVariantsBatchSchema, runMediaBackfillSchema, unlinkMediaFromProductSchema, updateMediaAssetSchema } from "./media.schemas.js";
import { assertS3ObjectExists, createS3DownloadUrl, inferContentTypeFromStorageKey, prepareUpload, readStorageObjectBuffer, resolveLocalPublicBaseUrl, resolveLocalUploadPath, resolvePublicUrlForStorageKey, resolveUploadConfig, sanitizeStorageKey, writeStorageObjectBuffer } from "./upload.service.js";
import { toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";
import { generateMediaVariantsForAsset } from "./media-variants.js";
import { runMediaVariantsBackfill } from "./media-variants-backfill.service.js";
import { regenerateVariantsForMediaIds } from "./media-variants-batch.js";
import { toPickerMediaItem } from "./media-picker.js";
import { toMediaAssetContract } from "./media-contract.js";

type LoggerLike = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type VariantGenerationOutcome = {
  generated?: number;
  skipped?: number;
  failed?: number;
  errors?: string[];
};

type FinalizeVariantGenerationResult = {
  variantsPending: boolean;
  variantErrors: string[];
  variants?: unknown[];
  variantKeys?: string[];
  generated?: number;
  skipped?: number;
  failed?: number;
};

type RegenerateSingleAssetVariantRecord = {
  key: string;
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
};

type RegenerateSingleAssetVariantsResult = {
  mediaId: string;
  generated: number;
  skipped: number;
  failed: number;
  variants: Array<RegenerateSingleAssetVariantRecord & { publicUrl: string }>;
  variantKeys: string[];
  variantErrors: string[];
};

function deriveEffectiveMediaKind(params: { requestedKind?: "IMAGE" | "VIDEO" | "FILE"; mimeType?: string | null }): "IMAGE" | "VIDEO" | "FILE" {
  const normalizedMimeType = String(params.mimeType ?? "").toLowerCase();
  const requestedKind = params.requestedKind ?? "FILE";
  if (requestedKind === "IMAGE" || normalizedMimeType.startsWith("image/")) return "IMAGE";
  return requestedKind;
}

async function attemptVariantGenerationOnFinalize(
  runGeneration: () => Promise<VariantGenerationOutcome>,
  logger: LoggerLike,
  options: { timeoutMs?: number; mediaAssetId: string },
): Promise<FinalizeVariantGenerationResult> {
  const timeoutMs = options.timeoutMs ?? 4000;

  try {
    const generationResult = await Promise.race<VariantGenerationOutcome | "timeout">([
      runGeneration(),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
    ]);

    if (generationResult === "timeout") {
      logger.warn({ mediaAssetId: options.mediaAssetId, timeoutMs }, "Media variant generation did not complete before finalize timeout; returning pending status");
      return { variantsPending: true, variantErrors: [] };
    }

    const variantErrors = generationResult.errors ?? [];
    if (variantErrors.length > 0) {
      logger.warn({ mediaAssetId: options.mediaAssetId, variantErrors }, "Media variant generation completed with per-variant errors");
    }

    return {
      variantsPending: false,
      variantErrors,
      generated: generationResult.generated ?? 0,
      skipped: generationResult.skipped ?? 0,
      failed: generationResult.failed ?? 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Variant generation failed";
    logger.warn({ mediaAssetId: options.mediaAssetId, err: error }, "Media variant generation failed during finalize");
    return {
      variantsPending: false,
      variantErrors: [message],
      failed: 1,
    };
  }
}

async function regenerateSingleAssetVariants(
  mediaId: string,
  options: {
    force?: boolean;
    timeoutMs?: number;
    runGeneration: (mediaId: string, opts: { force?: boolean }) => Promise<VariantGenerationOutcome>;
    loadVariantRecords: (mediaId: string) => Promise<{ mediaId: string; variants: RegenerateSingleAssetVariantRecord[] } | null>;
    resolveVariantPublicUrl: (storageKey: string) => string;
  },
): Promise<RegenerateSingleAssetVariantsResult> {
  const timeoutMs = options.timeoutMs ?? 6000;

  const generationResult = await Promise.race<VariantGenerationOutcome | "timeout">([
    options.runGeneration(mediaId, { force: options.force }),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
  ]);

  if (generationResult === "timeout") {
    throw new AppError(504, "Variant regeneration timed out", "MEDIA_VARIANT_TIMEOUT", { mediaId, timeoutMs });
  }

  const variantRecordPayload = await options.loadVariantRecords(mediaId);
  const variants = (variantRecordPayload?.variants ?? []).map((variant) => ({
    ...variant,
    publicUrl: options.resolveVariantPublicUrl(variant.storageKey),
  }));

  return {
    mediaId,
    generated: generationResult.generated ?? 0,
    skipped: generationResult.skipped ?? 0,
    failed: generationResult.failed ?? 0,
    variants,
    variantKeys: variants.map((variant) => variant.key),
    variantErrors: generationResult.errors ?? [],
  };
}

export const __testOnly__attemptVariantGenerationOnFinalize = attemptVariantGenerationOnFinalize;
export const __testOnly__regenerateSingleAssetVariants = regenerateSingleAssetVariants;
export const __testOnly__deriveEffectiveMediaKind = deriveEffectiveMediaKind;

export async function mediaRoutes(app: FastifyInstance) {
  let backfillInProgress = false;
  const variantRegenJobs = new Map<string, { status: "queued" | "running" | "succeeded" | "failed"; startedAt: number; finishedAt?: number; error?: string }>();
  const VARIANT_REGEN_MAX_MS = 25_000;
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

      const hasAlreadyOptimizedReason = result.diagnostics.some((item) => item.reason === "variants_already_exist");
      if (result.generated === 0 && !hasAlreadyOptimizedReason) {
        return reply.status(422).send({
          status: "failed",
          mode: result.mode,
          scanned: result.scanned,
          processed: result.assetsProcessed,
          skippedAssets: result.skippedAssets,
          created: result.generated,
          skipped: result.skipped,
          failed: result.failed,
          message: "Media variant backfill finished with zero generated variants and no already-existing variants.",
          succeededAssets: succeeded,
          failedAssets: result.failures.length,
          diagnostics: result.diagnostics,
          force: body.force,
          assetId: body.assetId ?? null,
          productId: body.productId ?? null,
          sharpAvailable: result.sharpAvailable,
          truncated: result.truncated,
        });
      }

      return reply.send({
        status: "ok",
        mode: result.mode,
        scanned: result.scanned,
        processed: result.assetsProcessed,
        skippedAssets: result.skippedAssets,
        created: result.generated,
        skipped: result.skipped,
        failed: result.failed,
        message: "Media variant backfill completed",
        succeededAssets: succeeded,
        failedAssets: result.failures.length,
        diagnostics: result.diagnostics,
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
    const cfg = await resolveUploadConfig();

    if (cfg.provider === "local") {
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      return reply.redirect(`${resolveLocalPublicBaseUrl()}/local-upload/${sanitizeStorageKey(storageKey)}`);
    }

    // With a stable public delivery domain configured, redirect to it: the target
    // URL never changes, so it is safe to cache and the browser/CDN serves it
    // directly (no ORB, no expiry).
    if (cfg.publicBaseUrl) {
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      return reply.redirect(await createS3DownloadUrl(storageKey, cfg));
    }

    // No public domain: stream the bytes through the API instead of redirecting to
    // a presigned URL. Redirecting is unsafe here because this response is cached
    // (immutable) while the presigned target expires (default 15m) — the browser
    // then reuses an expired URL, S3/R2 returns an XML error, and the <img> load is
    // blocked with net::ERR_BLOCKED_BY_ORB. Streaming serves stable, cacheable
    // image bytes with a correct same-API Content-Type.
    try {
      const buffer = await readStorageObjectBuffer(storageKey, cfg);
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      reply.header("Cross-Origin-Resource-Policy", "cross-origin");
      reply.type(inferContentTypeFromStorageKey(storageKey));
      return reply.send(buffer);
    } catch (error) {
      request.log.warn({ storageKey, err: error }, "Failed to serve media public object");
      return reply.status(404).send({ error: { message: "Media object not found" } });
    }
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
      const normalizedMimeType = String(body.metadata?.mimeType ?? "application/octet-stream").toLowerCase();
      const requestedKind = body.kind ?? "FILE";
      const effectiveKind = deriveEffectiveMediaKind({ requestedKind, mimeType: normalizedMimeType });

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
          mimeType: normalizedMimeType,
          byteSize: Number(body.metadata?.byteSize ?? 0),
          kind: effectiveKind,
          storageKey: body.storageKey,
          publicUrl: resolvedPublicUrl,
          altText: body.altText,
          uploadedById: request.user.sub,
          metadata: { ...(body.metadata ?? {}), storageProvider: cfg.provider } as Prisma.InputJsonValue,
        },
      });

      request.log.info({
        mediaAssetId: asset.id,
        storageKey: asset.storageKey,
        publicUrl: asset.publicUrl,
        kind: asset.kind,
        requestedKind,
        effectiveKind,
        mimeType: normalizedMimeType,
      }, "Media upload finalized");

      let variantStatus: FinalizeVariantGenerationResult = { variantsPending: false, variantErrors: [] };
      if (asset.kind === "IMAGE" && cfg.provider !== "cloudflare-r2") {
        request.log.info({ mediaAssetId: asset.id }, "Starting media variant generation on finalize");
        variantStatus = await attemptVariantGenerationOnFinalize(
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
        data: toMediaAssetContract((assetWithVariants ?? asset) as any, cfg),
        variantsPending: variantStatus.variantsPending,
        variantErrors: variantStatus.variantErrors,
      });
    },
  );

  app.put(
    "/admin/media/uploads/proxy",
    {
      preHandler: [app.verifyAdmin, app.requirePermission("media:write")],
      // Raw binary uploads bypass @fastify/multipart, so the default 1 MiB body
      // limit applies here. Align it with the 50 MB cap enforced by
      // createUploadSchema and the multipart config.
      bodyLimit: 50 * 1024 * 1024,
    },
    async (request, reply) => {
      const { storageKey: rawKey } = request.query as { storageKey?: string };
      if (!rawKey) throw new AppError(400, "Missing storageKey query parameter", "MISSING_STORAGE_KEY");
      const storageKey = sanitizeStorageKey(rawKey);
      const contentType = String(request.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim();
      const bodyBuffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from(String(request.body ?? ""));
      const cfg = await resolveUploadConfig();
      request.log.info({ storageKey, contentType, byteSize: bodyBuffer.length, provider: cfg.provider }, "Proxying upload to storage");
      await writeStorageObjectBuffer(storageKey, bodyBuffer, contentType, cfg);
      return reply.send({ ok: true });
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
        : items.map((item) => toMediaAssetContract(item as any, cfg));
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
        : items.map((item) => toMediaAssetContract(item as any, cfg));

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
          ...toMediaAssetContract(asset as any, cfg),
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
      const force = query.force === "true";
      const existing = variantRegenJobs.get(assetId);
      if (existing && (existing.status === "queued" || existing.status === "running")) {
        return reply.status(202).send({
          data: {
            status: existing.status,
            assetId,
            startedAt: existing.startedAt,
            message: "Variant regeneration already in progress",
          },
        });
      }

      const startedAt = Date.now();
      variantRegenJobs.set(assetId, { status: "queued", startedAt });

      void (async () => {
        try {
          variantRegenJobs.set(assetId, { status: "running", startedAt });
          request.log.info({ assetId, force }, "Async variant regeneration started");

          const media = await prisma.mediaAsset.findUnique({
            where: { id: assetId },
            select: { id: true, storageKey: true, kind: true, mimeType: true },
          });
          if (!media) throw new AppError(404, "Media asset not found", "MEDIA_NOT_FOUND");

          const cfg = await resolveUploadConfig();
          if (cfg.provider === "cloudflare-r2") {
            request.log.info({ assetId }, "Skipping Sharp variant regeneration for cloudflare-r2 asset");
            variantRegenJobs.set(assetId, { status: "succeeded", startedAt, finishedAt: Date.now() });
            return;
          }
          if (cfg.provider === "local") {
            const sourcePath = resolveLocalUploadPath(media.storageKey);
            const sourceExists = existsSync(sourcePath);
            request.log.info({ assetId, storageKey: media.storageKey, sourcePath, sourceExists }, "Variant regeneration local source check");
            if (!sourceExists) {
              throw new AppError(422, "source file missing", "MEDIA_VARIANT_SOURCE_MISSING", { assetId, storageKey: media.storageKey, sourcePath });
            }
          } else if (cfg.provider === "s3" || cfg.provider === "cloudflare-r2") {
            try {
              await assertS3ObjectExists(media.storageKey, cfg);
            } catch (error) {
              throw new AppError(422, "source file missing", "MEDIA_VARIANT_SOURCE_MISSING", { assetId, storageKey: media.storageKey, detail: error instanceof Error ? error.message : String(error) });
            }
          }

          const generation = await Promise.race([
            generateMediaVariantsForAsset(assetId, {
              force,
              logger: (event, meta) => request.log.info({ assetId, event, ...meta }, "Variant generation step"),
            }),
            new Promise<never>((_, reject) => {
              setTimeout(() => reject(new AppError(504, "Variant regeneration exceeded timeout window", "MEDIA_VARIANT_TIMEOUT", { assetId, timeoutMs: VARIANT_REGEN_MAX_MS })), VARIANT_REGEN_MAX_MS);
            }),
          ]);

          const finishedAt = Date.now();
          request.log.info({
            assetId,
            generated: generation.generated,
            skipped: generation.skipped,
            failed: generation.failed,
            errors: generation.errors,
            elapsedMs: finishedAt - startedAt,
          }, "Async variant regeneration completed");
          variantRegenJobs.set(assetId, { status: "succeeded", startedAt, finishedAt });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const finishedAt = Date.now();
          request.log.error({ assetId, err: error, elapsedMs: finishedAt - startedAt }, "Async variant regeneration failed");
          variantRegenJobs.set(assetId, { status: "failed", startedAt, finishedAt, error: message });
        } finally {
          setTimeout(() => {
            const current = variantRegenJobs.get(assetId);
            if (current?.finishedAt) variantRegenJobs.delete(assetId);
          }, 5 * 60_000).unref?.();
        }
      })();

      return reply.status(202).send({
        data: {
          status: "queued",
          assetId,
          startedAt,
          message: "Variant regeneration queued",
        },
      });
    },
  );

  app.post(
    "/admin/media/:mediaId/regenerate-variants",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const { mediaId } = request.params as { mediaId: string };
      // Routes are registered under env.API_PREFIX, so the redirect target must
      // include it; otherwise the browser follows Location to a prefix-less path
      // that does not exist and gets a 404.
      return reply.redirect(`${env.API_PREFIX}/admin/media/assets/${mediaId}/regenerate-variants`, 307);
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
