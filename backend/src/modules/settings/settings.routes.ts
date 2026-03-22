import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { listQuerySchema, toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";
import { upsertSettingSchema } from "./settings.schemas.js";

export async function settingsRoutes(app: FastifyInstance) {
  app.get(
    "/admin/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const { skip, take } = toPrismaPagination(query);

      const [items, total] = await Promise.all([
        prisma.setting.findMany({ skip, take, orderBy: [{ scope: "asc" }, { key: "asc" }] }),
        prisma.setting.count(),
      ]);

      return reply.send({ data: toPaginatedResponse(items, total, query) });
    },
  );

  app.put(
    "/admin/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const body = upsertSettingSchema.parse(request.body);
      const setting = await prisma.setting.upsert({
        where: { scope_key: { scope: body.scope, key: body.key } },
        update: { value: body.value as Prisma.InputJsonValue },
        create: { scope: body.scope, key: body.key, value: body.value as Prisma.InputJsonValue },
      });

      return reply.send({ data: setting });
    },
  );
}
