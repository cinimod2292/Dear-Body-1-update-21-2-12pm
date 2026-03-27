import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";

export interface PreparedUpload {
  storageKey: string;
  uploadUrl: string;
  publicUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

export async function prepareUpload(filename: string, mimeType: string): Promise<PreparedUpload> {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitized}`;

  if (env.UPLOAD_PROVIDER === "s3") {
    const endpoint = env.UPLOAD_ENDPOINT || `https://${env.UPLOAD_BUCKET}.s3.${env.UPLOAD_REGION}.amazonaws.com`;
    const objectUrl = `${endpoint}/${storageKey}`;
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

  const localBaseUrl = env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`;

  return {
    storageKey,
    uploadUrl: `${localBaseUrl}/local-upload/${storageKey}`,
    publicUrl: `${localBaseUrl}/local-upload/${storageKey}`,
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
  };
}
