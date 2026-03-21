import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

export const createCategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  parentId: z.string().cuid().optional(),
  isActive: z.boolean().default(true),
});

export const createAttributeSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  options: z.array(
    z.object({
      value: z.string().min(1),
      slug: z.string().min(1),
      position: z.number().int().min(0).default(0),
    }),
  ).default([]),
});

export const createTagSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  color: z.string().optional(),
});
