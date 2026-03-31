import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { encryptStorageSecret } from "../../lib/secrets.js";
import { listQuerySchema, toPaginatedResponse, toPrismaPagination } from "../../lib/pagination.js";
import { upsertSettingSchema, upsertStorageSettingsSchema } from "./settings.schemas.js";
import { assertS3ObjectExists, prepareUpload, resolveUploadConfig } from "../media/upload.service.js";

const STORAGE_SCOPE = "media";
const STORAGE_KEY = "storage";

function maskToken(value?: string) {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function toStorageResponse(value: Record<string, unknown>) {
  return {
    provider: String(value.provider ?? "local"),
    bucket: String(value.bucket ?? ""),
    accountId: String(value.accountId ?? ""),
    accessKeyId: String(value.accessKeyId ?? ""),
    accessKeyIdMasked: maskToken(typeof value.accessKeyId === "string" ? value.accessKeyId : ""),
    secretAccessKeyConfigured: Boolean(value.encryptedSecretAccessKey),
    endpoint: String(value.endpoint ?? ""),
    publicBaseUrl: String(value.publicBaseUrl ?? ""),
    signedUrlTtlSeconds: Number(value.signedUrlTtlSeconds ?? 900),
    forcePathStyle: Boolean(value.forcePathStyle ?? false),
  };
}

function normalizeStorageConfig(input: ReturnType<typeof upsertStorageSettingsSchema.parse>, existing: Record<string, unknown>) {
  const provider = input.provider;
  const accountId = input.accountId?.trim() || undefined;
  const endpoint = input.endpoint?.trim() || (provider === "cloudflare-r2" && accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const bucket = input.bucket?.trim() || undefined;
  const accessKeyId = input.accessKeyId?.trim() || undefined;
  const encryptedExistingSecret = typeof existing.encryptedSecretAccessKey === "string" ? existing.encryptedSecretAccessKey : undefined;
  const encryptedSecretAccessKey = input.secretAccessKey?.trim()
    ? encryptStorageSecret(input.secretAccessKey.trim())
    : encryptedExistingSecret;
  const publicBaseUrl = input.publicBaseUrl?.trim() || undefined;
  const signedUrlTtlSeconds = input.signedUrlTtlSeconds ?? Number(existing.signedUrlTtlSeconds ?? 900);
  const forcePathStyle = input.forcePathStyle ?? Boolean(existing.forcePathStyle ?? false);

  if (provider !== "local") {
    if (!bucket) throw new AppError(400, "Bucket is required", "STORAGE_BUCKET_REQUIRED");
    if (!endpoint) throw new AppError(400, "Endpoint is required", "STORAGE_ENDPOINT_REQUIRED");
    if (!accessKeyId) throw new AppError(400, "Access Key ID is required", "STORAGE_ACCESS_KEY_REQUIRED");
    if (!encryptedSecretAccessKey) throw new AppError(400, "Secret Access Key is required", "STORAGE_SECRET_REQUIRED");
  }

  return {
    provider,
    bucket,
    accountId,
    accessKeyId,
    encryptedSecretAccessKey,
    endpoint,
    publicBaseUrl,
    signedUrlTtlSeconds,
    forcePathStyle,
    region: "auto",
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get(
    "/admin/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const { skip, take } = toPrismaPagination(query);
      const [items, total] = await Promise.all([
        prisma.setting.findMany({ skip, take, orderBy: [{ scope: "asc" }, { key: "asc" }] }),
        prisma.setting.count(),
      ]);
      return reply.send({ data: toPaginatedResponse(items, total, query) });
    },
  );

  app.put(
    "/admin/settings",
    { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] },
    async (request, reply) => {
      const body = upsertSettingSchema.parse(request.body);
      const setting = await prisma.setting.upsert({
        where: { scope_key: { scope: body.scope, key: body.key } },
        update: { value: body.value as Prisma.InputJsonValue },
        create: { scope: body.scope, key: body.key, value: body.value as Prisma.InputJsonValue },
      });
      return reply.send({ data: setting });
    },
  );

  app.get("/admin/settings/storage", { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] }, async (_request, reply) => {
    const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: STORAGE_SCOPE, key: STORAGE_KEY } } });
    return reply.send({ data: toStorageResponse((setting?.value ?? {}) as Record<string, unknown>) });
  });

  app.put("/admin/settings/storage", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => {
    const body = upsertStorageSettingsSchema.parse(request.body);
    const existing = await prisma.setting.findUnique({ where: { scope_key: { scope: STORAGE_SCOPE, key: STORAGE_KEY } } });
    let normalized: ReturnType<typeof normalizeStorageConfig>;
    try {
      normalized = normalizeStorageConfig(body, (existing?.value ?? {}) as Record<string, unknown>);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, error instanceof Error ? error.message : "Failed to encrypt storage secret", "STORAGE_SECRET_ENCRYPTION_FAILED");
    }
    const saved = await prisma.setting.upsert({
      where: { scope_key: { scope: STORAGE_SCOPE, key: STORAGE_KEY } },
      update: { value: normalized as unknown as Prisma.InputJsonValue },
      create: { scope: STORAGE_SCOPE, key: STORAGE_KEY, value: normalized as unknown as Prisma.InputJsonValue },
    });
    return reply.send({ data: toStorageResponse(saved.value as Record<string, unknown>) });
  });

  app.post("/admin/settings/storage/test", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (_request, reply) => {
    const cfg = await resolveUploadConfig();
    if (cfg.provider === "local") {
      return reply.send({ data: { ok: true, message: "Local storage selected (development/test only)." } });
    }
    try {
      const prepared = await prepareUpload("storage-test.txt", "text/plain");
      const putRes = await fetch(prepared.uploadUrl, { method: "PUT", headers: prepared.headers, body: "storage-test" });
      if (!putRes.ok) {
        throw new Error(`Upload permission test failed (${putRes.status})`);
      }
      await assertS3ObjectExists(prepared.storageKey);
      return reply.send({ data: { ok: true, message: "Storage connection test succeeded. Ensure bucket CORS allows browser PUT from admin origin." } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Storage connection test failed";
      throw new AppError(400, msg, "STORAGE_TEST_FAILED");
    }
  });
}
