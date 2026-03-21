import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { createAttributeSchema, createBrandSchema, createCategorySchema, createTagSchema } from "./taxonomy.schemas.js";
import { listQuerySchema, toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";

export async function taxonomyRoutes(app: FastifyInstance) {
  app.post("/admin/brands", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const body = createBrandSchema.parse(request.body);
    const brand = await prisma.brand.create({ data: body });
    return reply.status(201).send({ data: brand });
  });

  app.get("/admin/brands", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { skip, take } = toPrismaPagination(query);
    const where = query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { slug: { contains: query.q, mode: "insensitive" as const } }] } : {};
    const [items, total] = await Promise.all([
      prisma.brand.findMany({ where, skip, take, orderBy: { [query.sortBy]: query.sortDir } }),
      prisma.brand.count({ where }),
    ]);
    return reply.send({ data: toPaginatedResponse(items, total, query) });
  });

  app.post("/admin/categories", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const body = createCategorySchema.parse(request.body);
    const category = await prisma.category.create({ data: body });
    return reply.status(201).send({ data: category });
  });

  app.get("/admin/categories", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { skip, take } = toPrismaPagination(query);
    const where = query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { slug: { contains: query.q, mode: "insensitive" as const } }] } : {};
    const [items, total] = await Promise.all([
      prisma.category.findMany({ where, skip, take, orderBy: { [query.sortBy]: query.sortDir }, include: { parent: true, subcategories: true } }),
      prisma.category.count({ where }),
    ]);
    return reply.send({ data: toPaginatedResponse(items, total, query) });
  });


  app.post("/admin/tags", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const body = createTagSchema.parse(request.body);
    const tag = await prisma.tag.create({ data: body });
    return reply.status(201).send({ data: tag });
  });

  app.get("/admin/tags", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const { skip, take } = toPrismaPagination(query);
    const where = query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { slug: { contains: query.q, mode: "insensitive" as const } }] } : {};
    const [items, total] = await Promise.all([
      prisma.tag.findMany({ where, skip, take, orderBy: { [query.sortBy]: query.sortDir } }),
      prisma.tag.count({ where }),
    ]);
    return reply.send({ data: toPaginatedResponse(items, total, query) });
  });

  app.post("/admin/attributes", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (request, reply) => {
    const body = createAttributeSchema.parse(request.body);
    const attribute = await prisma.attribute.create({
      data: {
        name: body.name,
        slug: body.slug,
        options: {
          create: body.options,
        },
      },
      include: { options: true },
    });

    return reply.status(201).send({ data: attribute });
  });

  app.get("/admin/attributes", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:read")] }, async (_request, reply) => {
    const items = await prisma.attribute.findMany({ include: { options: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "desc" } });
    return reply.send({ data: items });
  });
}
