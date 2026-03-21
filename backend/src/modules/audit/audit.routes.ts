import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { listQuerySchema, toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";

export async function auditRoutes(app: FastifyInstance) {
  app.get(
    "/admin/audit-logs",
    { preHandler: [app.verifyAdmin, app.requirePermission("audit:read")] },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const { skip, take } = toPrismaPagination(query);

      const where = query.q
        ? {
            OR: [
              { action: { contains: query.q, mode: "insensitive" as const } },
              { resourceType: { contains: query.q, mode: "insensitive" as const } },
              { actorEmail: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.auditLog.count({ where }),
      ]);

      return reply.send({ data: toPaginatedResponse(items, total, query) });
    },
  );
}
