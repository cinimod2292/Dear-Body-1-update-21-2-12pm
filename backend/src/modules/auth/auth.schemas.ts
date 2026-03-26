import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const customerRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(3).optional(),
  address: z.object({
    recipientName: z.string().min(1).optional(),
    line1: z.string().min(2),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().optional(),
    postalCode: z.string().min(2),
    country: z.string().min(2),
    phone: z.string().min(3).optional(),
  }).optional(),
});

export const customerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
