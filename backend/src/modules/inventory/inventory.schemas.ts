import { z } from "zod";

export const stockAdjustmentSchema = z.object({
  variantId: z.string().cuid(),
  quantityDelta: z.number().int(),
  reason: z.string().min(3).max(500),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

export const inventoryFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["updatedAt", "quantityOnHand", "lowStockThreshold"]).default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  outOfStockOnly: z.coerce.boolean().optional(),
});
