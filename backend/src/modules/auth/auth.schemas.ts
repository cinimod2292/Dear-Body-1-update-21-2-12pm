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
});

export const customerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const customerRefreshSchema = z.object({
  refreshToken: z.string().min(20),
});
