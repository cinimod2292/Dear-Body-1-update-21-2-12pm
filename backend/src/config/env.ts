import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().trim().default("/api").transform((value) => {
    if (!value) return "/api";
    const normalized = value.startsWith("/") ? value : `/${value}`;
    return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
  }),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  PUBLIC_BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("30m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  INITIAL_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_SUPER_ADMIN_PASSWORD: z.string().min(10).optional(),
  UPLOAD_PROVIDER: z.enum(["local", "s3", "cloudflare-r2"]).default("local"),
  UPLOAD_BUCKET: z.string().optional(),
  UPLOAD_REGION: z.string().optional(),
  UPLOAD_ENDPOINT: z.string().optional(),
  UPLOAD_PUBLIC_BASE_URL: z.string().url().optional(),
  UPLOAD_ACCESS_KEY_ID: z.string().optional(),
  UPLOAD_SECRET_ACCESS_KEY: z.string().optional(),
  UPLOAD_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().max(86_400).default(900),
  UPLOAD_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  EMAIL_PROVIDER: z.enum(["console", "smtp", "resend", "sendgrid"]).default("console"),
  EMAIL_FROM: z.string().email(),
  WEBHOOK_SIGNING_SECRET: z.string().min(8),
  PAYMENTS_ENCRYPTION_SECRET: z.string().min(16).optional(),
  STORAGE_ENCRYPTION_SECRET: z.string().min(16).optional(),
  SETUP_TOKEN: z.string().min(16).optional(),
  MEDIA_BACKFILL_TOKEN: z.string().min(16).optional(),
  MAINTENANCE_MODE: z.coerce.boolean().default(false),
  STOREFRONT_URL: z.string().url().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  BUILDER_DEBUG: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`[startup] Environment validation failed:\n${issues}`);
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

if (
  parsed.data.NODE_ENV === "production"
  && !/(?:\?|&)sslmode=require(?:&|$)/i.test(parsed.data.DATABASE_URL)
) {
  const message = "DATABASE_URL must include sslmode=require when NODE_ENV=production";
  console.error(`[startup] Environment validation failed:\n${message}`);
  throw new Error(`Invalid environment configuration:\n${message}`);
}


if (parsed.data.UPLOAD_PROVIDER === "cloudflare-r2") {
  const missing: string[] = [];
  if (!parsed.data.UPLOAD_BUCKET) missing.push("UPLOAD_BUCKET");
  if (!parsed.data.UPLOAD_ENDPOINT) missing.push("UPLOAD_ENDPOINT");
  if (!parsed.data.UPLOAD_ACCESS_KEY_ID) missing.push("UPLOAD_ACCESS_KEY_ID");
  if (!parsed.data.UPLOAD_SECRET_ACCESS_KEY) missing.push("UPLOAD_SECRET_ACCESS_KEY");
  if (!parsed.data.UPLOAD_PUBLIC_BASE_URL) missing.push("UPLOAD_PUBLIC_BASE_URL");
  if (missing.length) {
    const message = `Missing required Cloudflare R2 upload configuration: ${missing.join(", ")}`;
    console.error(`[startup] Environment validation failed:
${message}`);
    throw new Error(`Invalid environment configuration:
${message}`);
  }
}

export const env = parsed.data;
