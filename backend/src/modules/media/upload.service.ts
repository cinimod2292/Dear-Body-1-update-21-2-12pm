import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import path from "node:path";
import { env } from "../../config/env.js";

export interface PreparedUpload {
  storageKey: string;
  uploadUrl: string;
  publicUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

export function sanitizeStorageKey(storageKey: string): string {
  return storageKey.trim().replace(/^\/+/, "");
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function requireS3Config() {
  if (!env.UPLOAD_BUCKET) throw new Error("UPLOAD_BUCKET is required when UPLOAD_PROVIDER=s3");
  if (!env.UPLOAD_REGION) throw new Error("UPLOAD_REGION is required when UPLOAD_PROVIDER=s3");
  if (!env.UPLOAD_ACCESS_KEY_ID) throw new Error("UPLOAD_ACCESS_KEY_ID is required when UPLOAD_PROVIDER=s3");
  if (!env.UPLOAD_SECRET_ACCESS_KEY) throw new Error("UPLOAD_SECRET_ACCESS_KEY is required when UPLOAD_PROVIDER=s3");
  return {
    bucket: env.UPLOAD_BUCKET,
    region: env.UPLOAD_REGION,
    accessKeyId: env.UPLOAD_ACCESS_KEY_ID,
    secretAccessKey: env.UPLOAD_SECRET_ACCESS_KEY,
  };
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

function resolveS3Target(storageKey: string) {
  const { bucket } = requireS3Config();
  const normalizedStorageKey = sanitizeStorageKey(storageKey);

  if (env.UPLOAD_ENDPOINT) {
    const endpoint = new URL(env.UPLOAD_ENDPOINT);
    if (env.UPLOAD_FORCE_PATH_STYLE) {
      const origin = `${endpoint.protocol}//${endpoint.host}`;
      return {
        host: endpoint.host,
        canonicalUri: `/${bucket}/${normalizedStorageKey}`,
        publicBaseUrl: normalizeBaseUrl(env.UPLOAD_PUBLIC_BASE_URL || `${origin}/${bucket}`),
        origin,
      };
    }

    const host = `${bucket}.${endpoint.host}`;
    const origin = `${endpoint.protocol}//${host}`;
    return {
      host,
      canonicalUri: `/${normalizedStorageKey}`,
      publicBaseUrl: normalizeBaseUrl(env.UPLOAD_PUBLIC_BASE_URL || origin),
      origin,
    };
  }

  const host = `${bucket}.s3.${env.UPLOAD_REGION}.amazonaws.com`;
  const origin = `https://${host}`;
  return {
    host,
    canonicalUri: `/${normalizedStorageKey}`,
    publicBaseUrl: normalizeBaseUrl(env.UPLOAD_PUBLIC_BASE_URL || origin),
    origin,
  };
}

function createS3PresignedUrl(method: "PUT" | "HEAD", storageKey: string, expiresIn: number): string {
  const { region, accessKeyId, secretAccessKey } = requireS3Config();
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const signedHeaders = "host";
  const target = resolveS3Target(storageKey);
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

export function resolvePublicUrlForStorageKey(storageKey: string): string {
  if (env.UPLOAD_PROVIDER === "s3") {
    const target = resolveS3Target(storageKey);
    return `${target.publicBaseUrl}/${sanitizeStorageKey(storageKey)}`;
  }
  return `${resolveLocalPublicBaseUrl()}/local-upload/${sanitizeStorageKey(storageKey)}`;
}

export async function createS3UploadUrl(storageKey: string, mimeType: string): Promise<string> {
  void mimeType;
  return createS3PresignedUrl("PUT", storageKey, env.UPLOAD_SIGNED_URL_TTL_SECONDS);
}

export async function assertS3ObjectExists(storageKey: string): Promise<void> {
  const headUrl = createS3PresignedUrl("HEAD", storageKey, 60);
  const response = await fetch(headUrl, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`S3 HEAD failed with status ${response.status}`);
  }
}

export async function prepareUpload(filename: string, mimeType: string): Promise<PreparedUpload> {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitized}`;

  const publicUrl = resolvePublicUrlForStorageKey(storageKey);
  const uploadUrl = env.UPLOAD_PROVIDER === "s3"
    ? await createS3UploadUrl(storageKey, mimeType)
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
