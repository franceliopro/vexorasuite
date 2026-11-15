import { ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * BYO ("bring your own") Zernio: cada empresa pode usar a própria conta Zernio
 * (a Zernio oferece 2 conexões grátis por conta). Quem não configura usa a conta
 * compartilhada da Véxora (ZERNIO_API_KEY do servidor), apenas para o uso do
 * operador da plataforma.
 */
export type ZernioCredentialKind = "apiKey" | "webhookSecret";
const object = (value: any): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};

function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new ServiceUnavailableException("A proteção das conexões sociais precisa ser configurada no servidor.");
  return createHash("sha256").update("vexora-zernio-credentials-v1:").update(secret).digest();
}

export function encryptZernioCredential(tenantId: string, kind: ZernioCredentialKind, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(tenantId + ":zernio:" + kind));
  const ciphertext = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(integrations: unknown, tenantId: string, kind: ZernioCredentialKind): string | undefined {
  const creds = object(object(integrations).zernioCredentials);
  if (creds[kind] === undefined) return undefined;
  try {
    const [version, iv, tag, bytes, extra] = String(object(creds[kind]).encryptedKey || "").split(".");
    if (!tenantId || version !== "v1" || !iv || !tag || !bytes || extra || Buffer.from(iv, "base64url").length !== 12 || Buffer.from(tag, "base64url").length !== 16) throw new Error("Invalid credential");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(tenantId + ":zernio:" + kind));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const out = Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8");
    return out || undefined;
  } catch {
    throw new ServiceUnavailableException("Não foi possível abrir a conexão Zernio desta empresa. Cadastre-a novamente em Canais e integrações.");
  }
}

/** Chave a usar: a da empresa (BYO), senão a compartilhada do servidor (se existir). */
export function zernioApiKeyFor(integrations: unknown, tenantId: string): string | undefined {
  const own = decrypt(integrations, tenantId, "apiKey");
  if (own) return own;
  return process.env.ZERNIO_API_KEY?.trim() || undefined;
}

/** Segredo do webhook a usar: o da empresa (BYO), senão o compartilhado do servidor. */
export function zernioWebhookSecretFor(integrations: unknown, tenantId: string): string {
  const own = decrypt(integrations, tenantId, "webhookSecret");
  if (own) return own;
  return process.env.ZERNIO_WEBHOOK_SECRET || "";
}

export function zernioConnectionStatus(integrations: unknown) {
  const creds = object(object(integrations).zernioCredentials);
  const own = Boolean(creds.apiKey && creds.webhookSecret);
  return {
    source: own ? "tenant" as const : process.env.ZERNIO_API_KEY?.trim() ? "server" as const : null,
    tenantConfigured: own,
    updatedAt: typeof creds.apiKey?.updatedAt === "string" ? creds.apiKey.updatedAt : null,
  };
}
