import { z } from "zod";

export const cartCreateSchema = z.object({
  customerId: z.string().cuid().optional(),
  sessionId: z.string().optional(),
  currency: z.string().length(3).default("ZAR"),
});

export const cartItemCreateSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().positive().default(1),
});

export const cartItemUpdateSchema = z.object({
  quantity: z.number().int().positive(),
});

export const cartQuoteSchema = z.object({
  items: z.array(z.object({ variantId: z.string().cuid(), quantity: z.number().int().positive() })).min(1),
  shippingMethodId: z.string().cuid().optional(),
  shippingAddress: z.object({
    country: z.string().min(2),
    state: z.string().optional(),
  }).optional(),
  couponCode: z.string().optional(),
});

export const applyCouponSchema = z.object({
  code: z.string().min(2),
});

export const addressSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  line1: z.string().min(2),
  line2: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  postalCode: z.string().min(2),
  country: z.string().min(2),
});

export const checkoutSchema = z.object({
  email: z.string().email(),
  customerId: z.string().cuid().optional(),
  shippingAddress: addressSchema.optional(),
  billingAddress: addressSchema.optional(),
  shippingMethodId: z.string().cuid().optional(),
  couponCode: z.string().optional(),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
  pudoLockerCode: z.string().optional(),
  pudoLockerName: z.string().optional(),
  pudoLockerAddress: z.string().optional(),
  pudoDeliveryType: z.enum(["locker", "door"]).optional(),
  pudoShippingAmount: z.coerce.number().nonnegative().optional(),
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  sortBy: z.enum(["placedAt", "createdAt", "totalAmount", "orderNumber"]).default("placedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  status: z.enum(["PENDING", "AWAITING_PAYMENT", "PAID", "PICKING", "PROCESSING", "SHIPPED", "DELIVERED", "READY_FOR_COLLECTION", "CANCELLED", "PAYMENT_FAILED"]).optional(),
  paymentStatus: z.enum(["PENDING", "AWAITING_PAYMENT", "PAID", "FAILED", "CANCELLED", "REFUND_DUE"]).optional(),
  fulfillmentStatus: z.enum(["UNFULFILLED", "PARTIALLY_FULFILLED", "FULFILLED", "RETURNED", "CANCELLED"]).optional(),
});

export const orderStatusUpdateSchema = z.object({
  value: z.string().min(2),
  reason: z.string().optional(),
  trackingNumber: z.string().optional(),
  courier: z.string().optional(),
  shippedAt: z.coerce.date().optional(),
  deliveredAt: z.coerce.date().optional(),
});

export const orderNoteSchema = z.object({
  note: z.string().min(3),
  isInternal: z.boolean().default(true),
});

export const orderCancelSchema = z.object({
  reason: z.string().min(3),
});

export const refundSchema = z.object({
  amount: z.coerce.number().positive(),
  reason: z.string().optional(),
});

export const deleteAllOrdersSchema = z.object({
  confirmation: z.literal("DELETE ALL ORDERS"),
  password: z.string().min(1),
});
