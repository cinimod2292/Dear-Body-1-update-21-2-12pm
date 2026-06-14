import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { createAttributeSchema, createBrandSchema, createCategorySchema, createTagSchema } from "./taxonomy.schemas.js";
import { listQuerySchema, toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";

export async function taxonomyRoutes(app: FastifyInstance) {
  // Public storefront endpoints
  app.get("/store/brands", async (_request, reply) => {
    const brands = await prisma.brand.findMany({
      where: {
        isActive: true,
        products: { some: { status: "ACTIVE" } },
      },
      select: { id: true, name: true, slug: true, description: true, logoUrl: true },
      orderBy: { name: "asc" },
    });
    reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return reply.send({ data: brands });
  });

  app.get("/store/categories", async (_request, reply) => {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        products: { some: { status: "ACTIVE" } },
      },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { name: "asc" },
    });
    reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return reply.send({ data: categories });
  });

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

  // Seed missing category descriptions with sensible defaults
  app.post("/admin/categories/seed-descriptions", { preHandler: [app.verifyAdmin, app.requirePermission("catalog:write")] }, async (_request, reply) => {
    const DEFAULTS: Record<string, string> = {
      "body-spray": "Discover our premium range of Dear Body body sprays — long-lasting, skin-safe fragrances crafted for the South African climate. From fresh floral notes to warm oriental blends, our body sprays leave you feeling confident and beautifully scented throughout the day. Dermatologically tested and free from harsh chemicals, they're perfect for daily use on all skin types. Shop our full collection and find your signature scent.",
      "body-lotion": "Nourish, hydrate and protect your skin with Dear Body's luxurious body lotions. Enriched with skin-loving ingredients including shea butter, vitamin E and natural extracts, our lotions absorb quickly, leaving your skin soft, smooth and deeply moisturised. Delicately fragranced to complement our body spray range, they're ideal for building your personal scent layering routine. Made in South Africa for South African skin.",
      "body-scrub": "Reveal radiant, silky-smooth skin with Dear Body's exfoliating body scrubs. Our scrubs combine gentle physical exfoliants with nourishing oils to slough away dead skin cells while deeply moisturising — leaving your skin glowing, soft and refreshed. Use 2–3 times a week before moisturising for best results. Suitable for all skin types and proudly South African.",
      "body-butter": "Treat your skin to intense, long-lasting moisture with Dear Body's rich body butters. Whipped to a velvety texture, our body butters melt into skin to provide deep hydration that lasts all day. Ideal for dry skin, elbows, knees and heels, they lock in moisture and leave a subtle lingering fragrance. A South African skincare staple for beautifully nourished skin.",
      "gift-sets": "Looking for the perfect gift? Dear Body's beautifully curated gift sets make it easy to treat someone special — or yourself! Each set brings together our best-loved body sprays, lotions and scrubs in elegant packaging, ready to gift. Ideal for birthdays, Mother's Day, Christmas or any occasion. Free delivery available across South Africa on qualifying orders.",
    };

    const categories = await prisma.category.findMany({ select: { id: true, slug: true, description: true } });
    let updated = 0;
    for (const cat of categories) {
      if (cat.description) continue;
      const defaultDesc = DEFAULTS[cat.slug];
      if (!defaultDesc) continue;
      await prisma.category.update({ where: { id: cat.id }, data: { description: defaultDesc } });
      updated++;
    }
    return reply.send({ data: { updated, total: categories.length } });
  });
}
