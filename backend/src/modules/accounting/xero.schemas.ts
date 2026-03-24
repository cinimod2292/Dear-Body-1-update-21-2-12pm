import { z } from "zod";

export const xeroSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().min(3),
  clientSecret: z.string().min(6).optional(),
  redirectUri: z.string().url(),
  tenantId: z.string().optional(),
  scopes: z.array(z.string()).default(["openid", "profile", "email", "accounting.contacts", "accounting.transactions"]),
});

export const xeroSyncQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  entityType: z.enum(["CUSTOMER", "ORDER", "INVOICE"]).optional(),
});

export const xeroRetrySchema = z.object({
  force: z.boolean().default(false),
});
