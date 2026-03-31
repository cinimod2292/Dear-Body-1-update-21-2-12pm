import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import path from "node:path";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { decryptStorageSecret } from "../../lib/secrets.js";

export interface PreparedUpload {
  storageKey: string;
  uploadUrl: string;
  publicUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface UploadConfig {
  provider: "local" | "s3" | "cloudflare-r2";
  bucket?: string;
  endpoint?: string;
  publicBaseUrl?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  signedUrlTtlSeconds: number;
  forcePathStyle: boolean;
  region: string;
}

export function sanitizeStorageKey(storageKey: string): string {
  return storageKey.trim().replace(/^\/+/, "");
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function requireS3Config(cfg: UploadConfig) {
  if (!cfg.bucket) throw new Error("UPLOAD bucket is required");
  if (!cfg.region) throw new Error("UPLOAD region is required");
  if (!cfg.accessKeyId) throw new Error("UPLOAD access key id is required");
  if (!cfg.secretAccessKey) throw new Error("UPLOAD secret access key is required");
  return {
    bucket: cfg.bucket,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  };
}

function envConfig(): UploadConfig {
  return {
    provider: env.UPLOAD_PROVIDER,
    bucket: env.UPLOAD_BUCKET,
    endpoint: env.UPLOAD_ENDPOINT,
    publicBaseUrl: env.UPLOAD_PUBLIC_BASE_URL,
    accessKeyId: env.UPLOAD_ACCESS_KEY_ID,
    secretAccessKey: env.UPLOAD_SECRET_ACCESS_KEY,
    signedUrlTtlSeconds: env.UPLOAD_SIGNED_URL_TTL_SECONDS,
    forcePathStyle: env.UPLOAD_FORCE_PATH_STYLE,
    region: env.UPLOAD_REGION ?? "auto",
  };
}

async function dbConfig(): Promise<UploadConfig | null> {
  const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: "media", key: "storage" } } });
  if (!setting) return null;
  const value = setting.value as Record<string, unknown>;
  const encryptedSecret = typeof value.encryptedSecretAccessKey === "string" ? value.encryptedSecretAccessKey : "";
  return {
    provider: String(value.provider ?? "local") as UploadConfig["provider"],
    bucket: typeof value.bucket === "string" ? value.bucket : undefined,
    endpoint: typeof value.endpoint === "string" ? value.endpoint : undefined,
    publicBaseUrl: typeof value.publicBaseUrl === "string" ? value.publicBaseUrl : undefined,
    accessKeyId: typeof value.accessKeyId === "string" ? value.accessKeyId : undefined,
    secretAccessKey: encryptedSecret ? decryptStorageSecret(encryptedSecret) : undefined,
    signedUrlTtlSeconds: Number(value.signedUrlTtlSeconds ?? 900),
    forcePathStyle: Boolean(value.forcePathStyle ?? false),
    region: typeof value.region === "string" ? value.region : "auto",
  };
}

export async function resolveUploadConfig(): Promise<UploadConfig> {
  return (await dbConfig()) ?? envConfig();
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3Path(pathname: string): string {
  return pathname.split("/").map((segment) => encodeRfc3986(segment)).join("/");
}

function resolveS3Target(storageKey: string, cfg: UploadConfig) {
  const { bucket } = requireS3Config(cfg);
  const normalizedStorageKey = sanitizeStorageKey(storageKey);

  if (cfg.endpoint) {
    const endpoint = new URL(cfg.endpoint);
    if (cfg.forcePathStyle) {
      const origin = `${endpoint.protocol}//${endpoint.host}`;
      return {
        host: endpoint.host,
        canonicalUri: `/${bucket}/${normalizedStorageKey}`,
        publicBaseUrl: normalizeBaseUrl(cfg.publicBaseUrl || `${origin}/${bucket}`),
        origin,
      };
    }

    const host = `${bucket}.${endpoint.host}`;
    const origin = `${endpoint.protocol}//${host}`;
    return {
      host,
      canonicalUri: `/${normalizedStorageKey}`,
      publicBaseUrl: normalizeBaseUrl(cfg.publicBaseUrl || origin),
      origin,
    };
  }

  const host = `${bucket}.s3.${cfg.region}.amazonaws.com`;
  const origin = `https://${host}`;
  return {
    host,
    canonicalUri: `/${normalizedStorageKey}`,
    publicBaseUrl: normalizeBaseUrl(cfg.publicBaseUrl || origin),
    origin,
  };
}

function createS3PresignedUrl(method: "PUT" | "HEAD", storageKey: string, expiresIn: number, cfg: UploadConfig): string {
  const { region, accessKeyId, secretAccessKey } = requireS3Config(cfg);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const signedHeaders = "host";
  const target = resolveS3Target(storageKey, cfg);
  const canonicalUri = encodeS3Path(target.canonicalUri);

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalQueryString = queryParams.toString().replace(/\+/g, "%20");
  const canonicalHeaders = `host:${target.host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");
  queryParams.set("X-Amz-Signature", signature);
  return `${target.origin}${canonicalUri}?${queryParams.toString().replace(/\+/g, "%20")}`;
}

export function resolveLocalUploadRoot(): string {
  return path.resolve(process.cwd(), ".local-uploads");
}

export function resolveLocalUploadPath(storageKey: string): string {
  const localUploadRoot = resolveLocalUploadRoot();
  const sanitized = sanitizeStorageKey(storageKey);
  const resolved = path.resolve(localUploadRoot, sanitized);
  if (!resolved.startsWith(localUploadRoot)) {
    throw new Error("Invalid storage key path");
  }
  return resolved;
}

export function resolveLocalPublicBaseUrl(): string {
  if (env.NODE_ENV === "production") {
    throw new Error("UPLOAD_PROVIDER=local is not supported in production. Configure UPLOAD_PROVIDER=s3 for persistent media storage.");
  }
  if (env.PUBLIC_BASE_URL) return normalizeBaseUrl(env.PUBLIC_BASE_URL);
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return `http://localhost:${env.PORT}`;
  }
  throw new Error("PUBLIC_BASE_URL is required for local uploads outside development/test environments");
}

export function resolvePublicUrlForStorageKey(storageKey: string, cfg: UploadConfig): string {
  if (cfg.provider === "s3" || cfg.provider === "cloudflare-r2") {
    const target = resolveS3Target(storageKey, cfg);
    return `${target.publicBaseUrl}/${sanitizeStorageKey(storageKey)}`;
  }
  return `${resolveLocalPublicBaseUrl()}/local-upload/${sanitizeStorageKey(storageKey)}`;
}

export async function createS3UploadUrl(storageKey: string, mimeType: string, cfg: UploadConfig): Promise<string> {
  void mimeType;
  return createS3PresignedUrl("PUT", storageKey, cfg.signedUrlTtlSeconds, cfg);
}

export async function assertS3ObjectExists(storageKey: string): Promise<void> {
  const cfg = await resolveUploadConfig();
  const headUrl = createS3PresignedUrl("HEAD", storageKey, 60, cfg);
  const response = await fetch(headUrl, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`S3 HEAD failed with status ${response.status}`);
  }
}

export async function prepareUpload(filename: string, mimeType: string): Promise<PreparedUpload> {
  const cfg = await resolveUploadConfig();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitized}`;

  const publicUrl = resolvePublicUrlForStorageKey(storageKey, cfg);
  const uploadUrl = (cfg.provider === "s3" || cfg.provider === "cloudflare-r2")
    ? await createS3UploadUrl(storageKey, mimeType, cfg)
    : publicUrl;

  return {
    storageKey,
    uploadUrl,
    publicUrl,
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
  };
}
