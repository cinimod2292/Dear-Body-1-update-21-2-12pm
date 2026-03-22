import { z } from "zod";

export const reportRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const couponSchema = z.object({
  code: z.string().min(2),
  description: z.string().optional(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.coerce.number().positive(),
  minimumAmount: z.coerce.number().nonnegative().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  usageLimit: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

export const bulkCouponActionSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
  action: z.enum(["activate", "deactivate", "delete"]),
});

export const shippingMethodSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  minDeliveryDays: z.coerce.number().int().positive().optional(),
  maxDeliveryDays: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

export const taxRateSchema = z.object({
  country: z.string().min(2),
  state: z.string().optional(),
  name: z.string().min(2),
  rate: z.coerce.number().nonnegative(),
  isActive: z.boolean().default(true),
});

export const inquiryUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
});

export const newsletterCreateSchema = z.object({
  email: z.string().email(),
  source: z.string().default("admin"),
});

export const newsletterImportSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  source: z.string().default("import"),
});
