import { z } from "zod";

export const stitchSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["sandbox", "production"]).default("sandbox"),
  merchantId: z.string().min(1),
  apiKey: z.string().min(8).optional(),
  webhookSecret: z.string().min(8).optional(),
  redirectUrl: z.string().url().optional(),
  callbackUrl: z.string().url().optional(),
  apiBaseUrl: z.string().url().optional(),
});

export const payfastSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["sandbox", "live"]).default("sandbox"),
  sandboxMerchantId: z.string().min(1).optional(),
  sandboxMerchantKey: z.string().min(8).optional(),
  sandboxPassphrase: z.string().min(8).optional(),
  liveMerchantId: z.string().min(1).optional(),
  liveMerchantKey: z.string().min(8).optional(),
  livePassphrase: z.string().min(8).optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  notifyUrl: z.string().url().optional(),
});

export const paymentGatewaySchema = z.enum(["stitch", "payfast"]);

export const paymentInitiationSchema = z.object({
  gateway: paymentGatewaySchema.optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  force: z.boolean().optional().default(false),
});

export const paymentVerifySchema = z.object({
  gateway: paymentGatewaySchema.optional(),
  referenceId: z.string().min(2),
});

export const paymentEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().default(20).transform((perPage) => Math.min(perPage, 100)),
  gateway: z.string().optional(),
  status: z.string().optional(),
  q: z.string().optional(),
});
