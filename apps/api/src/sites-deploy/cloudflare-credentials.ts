import { ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cloudflare BYO ("bring your own") por empresa.
 *
 * O token fica criptografado em `tenants.integrations.cloudflare.apiToken`
 * (AES-256-GCM, AAD = tenantId) e o account id fica em texto claro, porque não
 * é segredo. Sem credencial da empresa, o deploy usa o token do servidor
 * (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID), quando existir.
 *
 * Nenhum token é aceito por request: o endpoint de configuração grava no banco
 * e o deploy sempre lê do banco/env.
 */
const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};

function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new ServiceUnavailableException("A proteção das credenciais Cloudflare precisa ser configurada no servidor.");
  return createHash("sha256").update("vexora-cloudflare-credentials-v1:").update(secret).digest();
}

export function encryptCloudflareToken(tenantId: string, token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(tenantId + ":cloudflare:apiToken"));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export type CloudflareCredential = { token: string; accountId: string; source: "tenant" | "server" };

/** Credencial efetiva. Erro de decifra nunca cai para o token do servidor. */
export function cloudflareCredential(integrations: unknown, tenantId: string): CloudflareCredential | null {
  const cloudflare = object(object(integrations).cloudflare);
  if (cloudflare.apiToken !== undefined) {
    const stored = object(cloudflare.apiToken);
    const accountId = typeof cloudflare.accountId === "string" ? cloudflare.accountId.trim() : "";
    try {
      const [version, iv, tag, bytes, extra] = String(stored.encryptedKey || "").split(".");
      if (!tenantId || !accountId || version !== "v1" || !iv || !tag || !bytes || extra ||
        Buffer.from(iv, "base64url").length !== 12 || Buffer.from(tag, "base64url").length !== 16) {
        throw new Error("Invalid credential");
      }
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
      decipher.setAAD(Buffer.from(tenantId + ":cloudflare:apiToken"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const token = Buffer.concat([decipher.update(Buffer.from(bytes, "base64url")), decipher.final()]).toString("utf8").trim();
      if (!token) throw new Error("Empty credential");
      return { token, accountId, source: "tenant" };
    } catch {
      throw new ServiceUnavailableException("Não foi possível abrir o token Cloudflare desta empresa. Cadastre-o novamente em Sites.");
    }
  }
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (token && accountId) return { token, accountId, source: "server" };
  return null;
}

export function cloudflareConnectionStatus(integrations: unknown, tenantId: string) {
  const stored = object(object(object(integrations).cloudflare).apiToken);
  try {
    const credential = cloudflareCredential(integrations, tenantId);
    return {
      configured: Boolean(credential),
      source: credential?.source ?? null,
      accountId: credential?.accountId ?? null,
      tenantConfigured: Boolean(stored.encryptedKey),
      updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
      needsRepair: false,
    };
  } catch {
    return { configured: false, source: "tenant" as const, accountId: null, tenantConfigured: true, updatedAt: null, needsRepair: true };
  }
}

/** Mescla a credencial no JSON `integrations` sem apagar outras integrações. */
export function withCloudflareCredential(
  integrations: unknown,
  encryptedKey: string,
  accountId: string,
  updatedAt: string,
) {
  const current = object(integrations);
  return {
    ...current,
    cloudflare: {
      ...object(current.cloudflare),
      accountId,
      apiToken: { encryptedKey, updatedAt },
    },
  };
}

export function withoutCloudflareCredential(integrations: unknown) {
  const current = object(integrations);
  const cloudflare = object(current.cloudflare);
  const { apiToken: _apiToken, ...rest } = cloudflare;
  return { ...current, cloudflare: rest };
}
