import { randomUUID } from "node:crypto";
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
  const normalizedStorageKey = sanitizeStorageKey(storageKey);
  if (env.UPLOAD_PROVIDER === "s3") {
    const endpoint = env.UPLOAD_ENDPOINT || `https://${env.UPLOAD_BUCKET}.s3.${env.UPLOAD_REGION}.amazonaws.com`;
    return `${normalizeBaseUrl(endpoint)}/${normalizedStorageKey}`;
  }
  return `${resolveLocalPublicBaseUrl()}/local-upload/${normalizedStorageKey}`;
}

export async function prepareUpload(filename: string, mimeType: string): Promise<PreparedUpload> {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitized}`;

  const objectUrl = resolvePublicUrlForStorageKey(storageKey);

  return {
    storageKey,
    uploadUrl: objectUrl,
    publicUrl: objectUrl,
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
  };
}
