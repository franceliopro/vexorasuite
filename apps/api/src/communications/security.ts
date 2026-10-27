import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
function key() {
  const secret =
    process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret)
    throw new ServiceUnavailableException(
      "Proteção das conexões não configurada.",
    );
  return createHash("sha256")
    .update("vexora-communications-v1:" + secret)
    .digest();
}
export function seal(tenantId: string, id: string, value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(tenantId + ":" + id));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function unseal(tenantId: string, id: string, value: string) {
  try {
    const [iv, tag, data] = value.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv!, "base64url"),
    );
    decipher.setAAD(Buffer.from(tenantId + ":" + id));
    decipher.setAuthTag(Buffer.from(tag!, "base64url"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(data!, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    throw new ServiceUnavailableException("Reconecte a conta de e-mail.");
  }
}
export function publicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const a = ip.split(".").map(Number);
    return !(
      a[0] === 0 ||
      a[0] === 10 ||
      a[0] === 127 ||
      a[0]! >= 224 ||
      (a[0] === 169 && a[1] === 254) ||
      (a[0] === 172 && a[1]! >= 16 && a[1]! <= 31) ||
      (a[0] === 192 && a[1] === 168) ||
      (a[0] === 100 && a[1]! >= 64 && a[1]! <= 127)
    );
  }
  return isIP(ip) === 6 && /^2[0-9a-f]{3}:/i.test(ip);
}
/** Resolve once and pin the transport to the validated IP; no DNS rebinding to internal services. */
export async function mailHost(host: string) {
  if (!/^[a-z0-9][a-z0-9.-]{1,251}[a-z0-9]$/i.test(host) || isIP(host))
    throw new BadRequestException("Use o nome público do servidor de e-mail.");
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new BadRequestException(
      "O servidor de e-mail deve ter um endereço público.",
    );
  return addresses[0]!.address;
}
