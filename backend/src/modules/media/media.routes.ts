import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { createUploadSchema, finalizeUploadSchema, mediaListQuerySchema, updateMediaAssetSchema } from "./media.schemas.js";
import { prepareUpload } from "./upload.service.js";
import { toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";

export async function mediaRoutes(app: FastifyInstance) {
  app.post(
    "/admin/media/uploads/prepare",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = createUploadSchema.parse(request.body);
      const prepared = await prepareUpload(body.filename, body.mimeType);
      return reply.send({ data: prepared });
    },
  );

  app.post(
    "/admin/media/uploads/finalize",
    { preHandler: [app.verifyAdmin, app.requirePermission("media:write")] },
    async (request, reply) => {
      const body = finalizeUploadSchema.parse(request.body);
      const asset = await prisma.mediaAsset.create({
        data: {
          filename: body.storageKey.split("/").pop() ?? body.storageKey,
          mimeType: body.metadata?.mimeType as string ?? "application/octet-stream",
          byteSize: Number(body.metadata?.byteSize ?? 0),
          kind: body.kind ?? "FILE",
          storageKey: body.storageKey,
          publicUrl: body.publicUrl,
          altText: body.altText,
          uploadedById: request.user.sub,
          metadata: body.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      return reply.send({ data: asset });
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
