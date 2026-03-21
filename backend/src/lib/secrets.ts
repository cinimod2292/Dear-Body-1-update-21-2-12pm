import crypto from "node:crypto";
import { env } from "../config/env.js";

const IV_LENGTH = 12;

function deriveKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

function getEncryptionSecret() {
  return env.PAYMENTS_ENCRYPTION_SECRET ?? env.JWT_ACCESS_SECRET;
}

export function encryptSecret(plainText: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(getEncryptionSecret());
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(cipherText: string) {
  const [ivHex, tagHex, dataHex] = cipherText.split(":");
  if (!ivHex || !tagHex || !dataHex) return "";
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(dataHex, "hex");
  const key = deriveKey(getEncryptionSecret());
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function hashBodySignature(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
