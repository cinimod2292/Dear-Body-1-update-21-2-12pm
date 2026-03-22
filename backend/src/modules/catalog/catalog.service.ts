import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { bulkProductActionSchema, createProductSchema, createVariantSchema, productFilterSchema, updateProductSchema, updateVariantSchema } from "./catalog.schemas.js";
import { toPaginatedResponse } from "../../lib/pagination.js";

export async function listProducts(rawQuery: unknown) {
  const query = productFilterSchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;
  const take = query.perPage;

  const where = {
    ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { slug: { contains: query.q, mode: "insensitive" as const } }] } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
    ...(query.brandId ? { brandId: query.brandId } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.featured !== undefined ? { featured: query.featured } : {}),
    ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy]: query.sortDir },
      include: {
        brand: true,
        category: true,
        seoMetadata: true,
        tags: { include: { tag: true } },
        galleries: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
        variants: { include: { inventoryLevel: true, attributeValues: { include: { attribute: true, option: true } } } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return toPaginatedResponse(items, total, query);
}

export async function createProduct(rawBody: unknown) {
  const body = createProductSchema.parse(rawBody);

  const created = await prisma.product.create({
    data: {
      name: body.name,
      slug: body.slug,
      description: body.description,
      shortDescription: body.shortDescription,
      status: body.status,
      visibility: body.visibility,
      featured: body.featured,
      brandId: body.brandId,
      categoryId: body.categoryId,
      defaultCurrency: body.defaultCurrency,
      publishedAt: body.status === "ACTIVE" ? new Date() : null,
      seoMetadata: body.seo ? { create: body.seo } : undefined,
      tags: body.tagIds.length ? { create: body.tagIds.map((tagId) => ({ tagId })) } : undefined,
      galleries: body.gallery.length
        ? {
            create: body.gallery.map((image) => ({ mediaAssetId: image.mediaAssetId, position: image.position, altText: image.altText })),
          }
        : undefined,
      relatedSource: body.relatedProductIds.length
        ? {
            create: body.relatedProductIds.map((targetProductId, index) => ({ targetProductId, position: index })),
          }
        : undefined,
    } as any,
    include: {
      seoMetadata: true,
      tags: { include: { tag: true } },
      galleries: true,
      relatedSource: true,
    },
  });

  if (body.featured) {
    await prisma.featuredProduct.upsert({
      where: { productId: created.id },
      update: {},
      create: { productId: created.id, position: 0 },
    });
  }

  return created;
}

export async function updateProduct(productId: string, rawBody: unknown) {
  const body = updateProductSchema.parse(rawBody);
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

  const seoMetadataUpdate = body.seo
    ? existing.seoMetadataId
      ? { update: body.seo }
      : { create: body.seo }
    : undefined;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.slug !== undefined ? { slug: body.slug } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.shortDescription !== undefined ? { shortDescription: body.shortDescription } : {}),
      ...(body.status !== undefined ? { status: body.status, publishedAt: body.status === "ACTIVE" ? (existing.publishedAt ?? new Date()) : null } : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.featured !== undefined ? { featured: body.featured } : {}),
      ...(body.brandId !== undefined ? { brandId: body.brandId } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
      ...(seoMetadataUpdate ? { seoMetadata: seoMetadataUpdate } : {}),
      ...(body.tagIds ? { tags: { deleteMany: {}, create: body.tagIds.map((tagId) => ({ tagId })) } } : {}),
      ...(body.relatedProductIds ? { relatedSource: { deleteMany: {}, create: body.relatedProductIds.map((targetProductId, index) => ({ targetProductId, position: index })) } } : {}),
      ...(body.gallery ? { galleries: { deleteMany: {}, create: body.gallery.map((image) => ({ mediaAssetId: image.mediaAssetId, position: image.position, altText: image.altText })) } } : {}),
    } as any,
    include: {
      seoMetadata: true,
      tags: { include: { tag: true } },
      galleries: { include: { mediaAsset: true }, orderBy: { position: "asc" } },
      relatedSource: true,
    },
  });

  if (body.featured === true) {
    await prisma.featuredProduct.upsert({ where: { productId }, update: {}, create: { productId, position: 0 } });
  }
  if (body.featured === false) {
    await prisma.featuredProduct.deleteMany({ where: { productId } });
  }

  return updated;
}

export async function createVariant(productId: string, rawBody: unknown) {
  const body = createVariantSchema.parse(rawBody);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

  return prisma.productVariant.create({
    data: {
      productId,
      title: body.title,
      sku: body.sku,
      barcode: body.barcode,
      price: body.price,
      salePrice: body.salePrice,
      costPrice: body.costPrice,
      currency: body.currency,
      trackInventory: body.trackInventory,
      allowBackorder: body.allowBackorder,
      backorderLimit: body.backorderLimit,
      outOfStockBehavior: body.outOfStockBehavior,
      isActive: body.isActive,
      inventoryLevel: {
        create: {
          quantityOnHand: body.quantityOnHand,
          lowStockThreshold: body.lowStockThreshold,
        },
      },
      attributeValues: {
        create: body.attributes.map((attr) => ({
          attributeId: attr.attributeId,
          optionId: attr.optionId,
        })),
      },
      stockMovements: {
        create: {
          movementType: "INITIAL_STOCK",
          quantityDelta: body.quantityOnHand,
          quantityBefore: 0,
          quantityAfter: body.quantityOnHand,
          reason: "Initial stock set on variant creation",
        },
      },
    },
    include: {
      inventoryLevel: true,
      attributeValues: { include: { attribute: true, option: true } },
      stockMovements: true,
    },
  });
}

export async function updateVariant(variantId: string, rawBody: unknown) {
  const body = updateVariantSchema.parse(rawBody);
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { inventoryLevel: true } });
  if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.sku !== undefined ? { sku: body.sku } : {}),
      ...(body.barcode !== undefined ? { barcode: body.barcode } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
      ...(body.salePrice !== undefined ? { salePrice: body.salePrice } : {}),
      ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.trackInventory !== undefined ? { trackInventory: body.trackInventory } : {}),
      ...(body.allowBackorder !== undefined ? { allowBackorder: body.allowBackorder } : {}),
      ...(body.backorderLimit !== undefined ? { backorderLimit: body.backorderLimit } : {}),
      ...(body.outOfStockBehavior !== undefined ? { outOfStockBehavior: body.outOfStockBehavior } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.attributes
        ? {
            attributeValues: {
              deleteMany: {},
              create: body.attributes.map((attr) => ({ attributeId: attr.attributeId, optionId: attr.optionId })),
            },
          }
        : {}),
      ...((body.quantityOnHand !== undefined || body.lowStockThreshold !== undefined)
        ? {
            inventoryLevel: {
              upsert: {
                create: {
                  quantityOnHand: body.quantityOnHand ?? 0,
                  lowStockThreshold: body.lowStockThreshold ?? 5,
                },
                update: {
                  ...(body.quantityOnHand !== undefined ? { quantityOnHand: body.quantityOnHand } : {}),
                  ...(body.lowStockThreshold !== undefined ? { lowStockThreshold: body.lowStockThreshold } : {}),
                },
              },
            },
          }
        : {}),
    },
    include: {
      inventoryLevel: true,
      attributeValues: { include: { attribute: true, option: true } },
    },
  });

  return updated;
}

export async function bulkProductAction(rawBody: unknown) {
  const body = bulkProductActionSchema.parse(rawBody);

  if (body.action === "delete") {
    const deleted = await prisma.product.deleteMany({ where: { id: { in: body.productIds } } });
    return { count: deleted.count, action: body.action };
  }

  if (body.action === "set_status") {
    if (!body.status) throw new AppError(400, "Missing status", "VALIDATION_ERROR");
    const updated = await prisma.product.updateMany({ where: { id: { in: body.productIds } }, data: { status: body.status } });
    return { count: updated.count, action: body.action };
  }

  if (body.action === "set_visibility") {
    if (!body.visibility) throw new AppError(400, "Missing visibility", "VALIDATION_ERROR");
    const updated = await prisma.product.updateMany({ where: { id: { in: body.productIds } }, data: { visibility: body.visibility } });
    return { count: updated.count, action: body.action };
  }

  if (body.action === "set_featured") {
    if (body.featured === undefined) throw new AppError(400, "Missing featured", "VALIDATION_ERROR");
    const updated = await prisma.product.updateMany({ where: { id: { in: body.productIds } }, data: { featured: body.featured } });
    if (body.featured) {
      await prisma.featuredProduct.createMany({
        data: body.productIds.map((productId, index) => ({ productId, position: index })),
        skipDuplicates: true,
      });
    } else {
      await prisma.featuredProduct.deleteMany({ where: { productId: { in: body.productIds } } });
    }
    return { count: updated.count, action: body.action };
  }

  throw new AppError(400, "Unsupported action", "VALIDATION_ERROR");
}
