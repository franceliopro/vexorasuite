import { BadRequestException } from "@nestjs/common";
import { promises as dns } from "node:dns";

/** Fetch com guarda SSRF: só HTTPS público, sem credenciais embutidas, sem loopback/RFC1918. */

const isPrivateIp = (ip: string): boolean => {
  if (ip.includes(":")) {
    const norm = ip.toLowerCase();
    return norm === "::1" || norm.startsWith("fe80") || norm.startsWith("fc") || norm.startsWith("fd") || norm.startsWith("::ffff:127.") || norm.startsWith("::ffff:10.") || norm.startsWith("::ffff:192.168.") || norm.startsWith("::ffff:169.254.") || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(norm);
  }
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};

/** Só HTTPS em host público — bloqueia loopback, RFC1918, CGNAT e link-local. */
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(String(raw || "").trim()); } catch { throw new BadRequestException("URL inválida. Use https://…"); }
  if (url.protocol !== "https:") throw new BadRequestException("A URL do site precisa usar https://");
  if (url.username || url.password) throw new BadRequestException("A URL não pode conter usuário ou senha.");
  if (!url.hostname.includes(".")) throw new BadRequestException("Host inválido.");
  let addresses: { address: string }[];
  try { addresses = await dns.lookup(url.hostname, { all: true }); } catch { throw new BadRequestException("Não foi possível resolver o domínio. Confira se o site está no ar."); }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) throw new BadRequestException("Endereço não permitido: o site precisa estar em um IP público.");
  return url;
}

export async function fetchTextGuarded(startUrl: string, maxBytes: number, timeoutMs: number, accept: string): Promise<{ text: string; finalUrl: string }> {
  let current = startUrl;
  for (let hop = 0; hop < 3; hop++) {
    await assertPublicHttpsUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "Mozilla/5.0 (compatible; VexoraBot/1.0; +https://vexorasuite.com.br)", accept },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new BadRequestException("O site redirecionou para um endereço vazio.");
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new BadRequestException("O site respondeu com erro " + response.status + ". Verifique se está no ar.");
    const reader = response.body?.getReader();
    if (!reader) throw new BadRequestException("Resposta vazia do site.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > maxBytes) throw new BadRequestException("O site é grande demais para ser clonado por aqui (limite de segurança).");
        chunks.push(part.value);
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    return { text: Buffer.concat(chunks).toString("utf8"), finalUrl: current };
  }
  throw new BadRequestException("O site tem redirecionamentos demais.");
}

/** Fetch com o mesmo guarda SSRF, devolvendo bytes + content-type (assets de site). */
export async function fetchBinaryGuarded(startUrl: string, maxBytes: number, timeoutMs: number, accept: string): Promise<{ bytes: Uint8Array; contentType: string; finalUrl: string }> {
  let current = startUrl;
  for (let hop = 0; hop < 3; hop++) {
    await assertPublicHttpsUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "Mozilla/5.0 (compatible; VexoraBot/1.0; +https://vexorasuite.com.br)", accept },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new BadRequestException("O recurso redirecionou para um endereço vazio.");
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new BadRequestException("O recurso respondeu com erro " + response.status + ".");
    const contentType = String(response.headers.get("content-type") || "application/octet-stream").split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
    const reader = response.body?.getReader();
    if (!reader) throw new BadRequestException("Resposta vazia do recurso.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > maxBytes) throw new BadRequestException("O recurso é grande demais para ser clonado por aqui (limite de segurança).");
        chunks.push(part.value);
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    return { bytes: new Uint8Array(Buffer.concat(chunks)), contentType, finalUrl: current };
  }
  throw new BadRequestException("O recurso tem redirecionamentos demais.");
}
