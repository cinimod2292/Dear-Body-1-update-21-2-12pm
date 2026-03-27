import { z } from "zod";

export const customerProfileUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(3).optional(),
});

export const customerAddressSchema = z.object({
  recipientName: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  phone: z.string().min(3).optional(),
  line1: z.string().min(2),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  postalCode: z.string().min(2),
  country: z.string().min(2),
  deliveryNotes: z.string().optional(),
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});

export const customerAddressUpdateSchema = customerAddressSchema.partial().extend({
  line1: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  postalCode: z.string().min(2).optional(),
  country: z.string().min(2).optional(),
});

export const customerAddressDefaultSchema = z.object({
  type: z.enum(["shipping", "billing"]),
});
