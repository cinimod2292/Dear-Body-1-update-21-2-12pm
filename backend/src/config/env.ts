import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default("/api"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  INITIAL_SUPER_ADMIN_EMAIL: z.string().email(),
  INITIAL_SUPER_ADMIN_PASSWORD: z.string().min(10),
  UPLOAD_PROVIDER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_BUCKET: z.string().optional(),
  UPLOAD_REGION: z.string().optional(),
  UPLOAD_ENDPOINT: z.string().optional(),
  UPLOAD_ACCESS_KEY_ID: z.string().optional(),
  UPLOAD_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["console", "smtp", "resend"]).default("console"),
  EMAIL_FROM: z.string().email(),
  WEBHOOK_SIGNING_SECRET: z.string().min(8),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
