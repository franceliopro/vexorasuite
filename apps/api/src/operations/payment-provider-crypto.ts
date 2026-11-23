import { ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Mesmo formato do Asaas: v1:<iv>:<tag>:<cipher>, AES-256-GCM com chave derivada do ambiente. */
export class IntegrationEncryptionError extends Error {}

function key(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new ServiceUnavailableException("Configure JWT_ACCESS_SECRET ou INTEGRATION_ENCRYPTION_KEY antes de salvar credenciais.");
  return createHash("sha256").update(secret).digest();
}

export function encryptIntegrationSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptIntegrationSecret(value: string, providerLabel: string): string {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new IntegrationEncryptionError(`Credencial ${providerLabel} em formato inválido.`);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
  } catch {
    throw new IntegrationEncryptionError(`Não foi possível descriptografar a credencial ${providerLabel}. Confira a chave de criptografia.`);
  }
}
