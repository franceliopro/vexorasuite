import { ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Credenciais do WhatsApp Oficial (Meta WhatsApp Cloud API) por empresa.
 * Cada empresa configura o próprio app/número no Meta; a Véxora apenas cifra
 * e usa os segredos quando a própria empresa envia ou recebe mensagens.
 */
export type MetaCredentialKind = "accessToken" | "appSecret" | "verifyToken";
const object = (value: any): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new ServiceUnavailableException("A proteção das conexões sociais precisa ser configurada no servidor.");
  return createHash("sha256").update("vexora-meta-credentials-v1:").update(secret).digest();
}

export function encryptMetaCredential(tenantId: string, kind: MetaCredentialKind, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(tenantId + ":meta:" + kind));
  const ciphertext = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(integrations: unknown, tenantId: string, kind: MetaCredentialKind): string | undefined {
  const creds = object(object(integrations).metaCredentials);
  if (creds[kind] === undefined) return undefined;
  try {
    const [version, iv, tag, bytes, extra] = String(object(creds[kind]).encryptedKey || "").split(".");
    if (!tenantId || version !== "v1" || !iv || !tag || !bytes || extra || Buffer.from(iv, "base64url").length !== 12 || Buffer.from(tag, "base64url").length !== 16) throw new Error("Invalid credential");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(tenantId + ":meta:" + kind));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const out = Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8");
    return out || undefined;
  } catch {
    throw new ServiceUnavailableException("Não foi possível abrir a conexão Meta desta empresa. Cadastre-a novamente em Conexões.");
  }
}

export function metaAccessTokenFor(integrations: unknown, tenantId: string): string | undefined {
  return decrypt(integrations, tenantId, "accessToken");
}
export function metaAppSecretFor(integrations: unknown, tenantId: string): string | undefined {
  return decrypt(integrations, tenantId, "appSecret");
}
export function metaVerifyTokenFor(integrations: unknown, tenantId: string): string | undefined {
  return decrypt(integrations, tenantId, "verifyToken");
}
export function metaConnectionStatus(integrations: unknown) {
  const creds = object(object(integrations).metaCredentials);
  const configured = Boolean(creds.accessToken && creds.appSecret && creds.verifyToken);
  return {
    configured,
    updatedAt: typeof creds.accessToken?.updatedAt === "string" ? creds.accessToken.updatedAt : null,
  };
}
export function timingSafeStringEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
