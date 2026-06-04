import { z } from "zod";

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  sortBy: z.enum(["createdAt", "updatedAt", "lastOrderAt", "lifetimeValue", "averageOrderValue", "email"]).default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  status: z.enum(["LEAD", "ACTIVE", "VIP", "INACTIVE", "BLOCKED"]).optional(),
  marketingEmailConsent: z.coerce.boolean().optional(),
  marketingSmsConsent: z.coerce.boolean().optional(),
  tagId: z.string().cuid().optional(),
  minLtv: z.coerce.number().optional(),
  maxLtv: z.coerce.number().optional(),
});

export const createCustomerSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(["LEAD", "ACTIVE", "VIP", "INACTIVE", "BLOCKED"]).default("LEAD"),
  marketingEmailConsent: z.boolean().default(false),
  marketingSmsConsent: z.boolean().default(false),
  tagIds: z.array(z.string().cuid()).default([]),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const addCustomerNoteSchema = z.object({
  note: z.string().min(3),
  isPinned: z.boolean().default(false),
});

export const addCustomerInteractionSchema = z.object({
  type: z.enum(["NOTE", "EMAIL", "PHONE", "CHAT", "TICKET"]).default("NOTE"),
  channel: z.string().optional(),
  subject: z.string().optional(),
  summary: z.string().min(3),
  happenedAt: z.string().datetime().optional(),
});

export const addCustomerTagSchema = z.object({
  tagId: z.string().cuid(),
});

export const supportInquirySchema = z.object({
  email: z.string().email(),
  subject: z.string().min(3),
  message: z.string().min(5),
  customerId: z.string().cuid().optional(),
});

const addressFields = {
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().optional().nullable(),
  postalCode: z.string().min(1),
  country: z.string().min(2),
  recipientName: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
};

export const createAddressSchema = z.object(addressFields);
export const updateAddressSchema = z.object(addressFields).partial();
