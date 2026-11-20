/** Busca de HTML público para clonagem, com proteção contra SSRF. */
import { BadRequestException } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_HTML_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

function ipv4Parts(value: string): number[] | null {
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

/** Bloqueia redes privadas, loopback, link-local, metadata e faixas de documentação. */
export function isPrivateAddress(address: string): boolean {
  let ip = address.trim().toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  const v4 = ipv4Parts(ip);
  if (v4) {
    const [a, b, c] = v4 as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    return false;
  }
  if (isIP(ip) === 6) {
    const normalized = ip.replace(/^0+/, "");
    if (normalized === "::" || normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
    if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true; // fc00::/7
    if (/^fe[89ab][0-9a-f]:/.test(ip)) return true; // fe80::/10
    if (/^ff[0-9a-f]{2}:/.test(ip)) return true; // multicast
    if (/^2001:0db8:/.test(ip)) return true; // documentação
    return false;
  }
  return true;
}

export function assertPublicHttpUrl(input: unknown): URL {
  if (typeof input !== "string" || !input.trim()) {
    throw new BadRequestException("Informe a URL do site que deseja clonar.");
  }
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new BadRequestException("URL inválida. Use o endereço completo, como https://exemplo.com.br.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("A clonagem aceita apenas links http:// ou https://.");
  }
  if (url.username || url.password) {
    throw new BadRequestException("Links com usuário e senha não são aceitos.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const literalIp = isIP(host) !== 0;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new BadRequestException("Não é possível clonar endereços internos ou privados.");
  }
  if (literalIp && isPrivateAddress(host)) {
    throw new BadRequestException("Não é possível clonar endereços internos ou privados.");
  }
  return url;
}

async function assertPublicAddress(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) throw new BadRequestException("O endereço aponta para uma rede interna.");
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new BadRequestException("Não foi possível resolver o domínio informado.");
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new BadRequestException("O domínio aponta para uma rede interna. Use um site público.");
  }
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new BadRequestException("O site não retornou conteúdo HTML.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new BadRequestException("A página é grande demais para clonar (limite: 2 MB).");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Busca HTML público, seguindo no máximo 3 redirecionamentos e revalidando cada destino. */
export async function fetchPublicHtml(input: unknown, redirects = 0): Promise<{ html: string; url: URL }> {
  const url = assertPublicHttpUrl(input);
  await assertPublicAddress(url);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "user-agent": "VexoraSites/1.0 (+site-cloner)", accept: "text/html,application/xhtml+xml" },
    });
  } catch {
    throw new BadRequestException("Não foi possível acessar a página. Confira o link e tente novamente.");
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location || redirects >= MAX_REDIRECTS) {
      throw new BadRequestException("O site redirecionou demais. Informe o endereço final.");
    }
    return fetchPublicHtml(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) {
    throw new BadRequestException(`O site respondeu ${response.status}. Não foi possível clonar a página.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new BadRequestException("O link não aponta para uma página HTML.");
  }
  return { html: await readLimited(response), url };
}
