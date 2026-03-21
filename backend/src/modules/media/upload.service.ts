import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";

export interface PreparedUpload {
  storageKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
}

export async function prepareUpload(filename: string, mimeType: string): Promise<PreparedUpload> {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageKey = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitized}`;

  if (env.UPLOAD_PROVIDER === "s3") {
    const endpoint = env.UPLOAD_ENDPOINT || `https://${env.UPLOAD_BUCKET}.s3.${env.UPLOAD_REGION}.amazonaws.com`;
    return {
      storageKey,
      uploadUrl: `${endpoint}/${storageKey}`,
      method: "PUT",
      headers: {
        "content-type": mimeType,
      },
    };
  }

  return {
    storageKey,
    uploadUrl: `http://localhost:${env.PORT}/local-upload/${storageKey}`,
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
  };
}
