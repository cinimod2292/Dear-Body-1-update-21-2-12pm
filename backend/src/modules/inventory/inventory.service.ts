import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { inventoryFilterSchema, stockAdjustmentSchema } from "./inventory.schemas.js";
import { toPaginatedResponse } from "../../lib/pagination.js";

export async function listInventory(rawQuery: unknown) {
  const query = inventoryFilterSchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;
  const take = query.perPage;

  const where = {
    ...(query.q
      ? {
          variant: {
            OR: [
              { sku: { contains: query.q, mode: "insensitive" as const } },
              { product: { name: { contains: query.q, mode: "insensitive" as const } } },
            ],
          },
        }
      : {}),
    ...(query.outOfStockOnly ? { quantityOnHand: { lte: 0 } } : {}),
  };

  const [allItems] = await Promise.all([
    prisma.inventoryLevel.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortDir },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
    }),
  ]);

  const filtered = query.lowStockOnly
    ? allItems.filter((item) => item.quantityOnHand <= item.lowStockThreshold)
    : allItems;

  const total = filtered.length;
  const items = filtered.slice(skip, skip + take);

  return toPaginatedResponse(items, total, query);
}

export async function adjustStock(rawBody: unknown, actorUserId?: string) {
  const body = stockAdjustmentSchema.parse(rawBody);

  const variant = await prisma.productVariant.findUnique({ where: { id: body.variantId }, include: { inventoryLevel: true } });
  if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");

  const currentQty = variant.inventoryLevel?.quantityOnHand ?? 0;
  const nextQty = currentQty + body.quantityDelta;

  if (nextQty < 0 && !variant.allowBackorder) {
    throw new AppError(400, "Stock cannot become negative when backorders are disabled", "NEGATIVE_STOCK_NOT_ALLOWED");
  }

  const result = await prisma.$transaction(async (tx) => {
    const level = await tx.inventoryLevel.upsert({
      where: { variantId: body.variantId },
      create: {
        variantId: body.variantId,
        quantityOnHand: nextQty,
      },
      update: {
        quantityOnHand: nextQty,
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        variantId: body.variantId,
        movementType: "MANUAL_ADJUSTMENT",
        quantityDelta: body.quantityDelta,
        quantityBefore: currentQty,
        quantityAfter: nextQty,
        reason: body.reason,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        createdById: actorUserId,
      },
    });

    return { level, movement };
  });

  return result;
}

export async function listStockMovements(variantId: string) {
  return prisma.stockMovement.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
}
