import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { createUploadSchema, finalizeUploadSchema } from "./media.schemas.js";
import { prepareUpload } from "./upload.service.js";
import { listQuerySchema, toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";

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
      const query = listQuerySchema.parse(request.query);
      const { skip, take } = toPrismaPagination(query);

      const where = query.q
        ? {
            OR: [
              { filename: { contains: query.q, mode: "insensitive" as const } },
              { storageKey: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [items, total] = await Promise.all([
        prisma.mediaAsset.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.mediaAsset.count({ where }),
      ]);

      return reply.send({ data: toPaginatedResponse(items, total, query) });
    },
  );
}
