import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  return createHash("sha256").update(process.env.WEBHOOK_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET || "development-webhook-key").digest();
}

export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function decryptWebhookSecret(value: string) {
  const raw = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export function generateWebhookSecret() {
  return "vxwh_" + randomBytes(32).toString("base64url");
}

export function signWebhookPayload(secret: string, payload: string) {
  return createHash("sha256").update(secret + ":" + payload).digest("hex");
}