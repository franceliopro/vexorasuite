import { BadRequestException } from "@nestjs/common";

export const STOREFRONT_NOTICE =
  "Preços e disponibilidade vêm do catálogo ativo da Véxora. Esta vitrine não confirma pagamento, pedido ou conexão com provedor.";

const UUID_PATTERN = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

const trimmed = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max + 1) : "";

/** URL base HTTPS configurada; nunca inventa domínio nem aceita credenciais/query. */
export function normalizeStorefrontSiteUrl(raw: unknown): string | null {
  const value = trimmed(raw, 1000);
  if (!value || value.length > 1000) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (!url.hostname.includes(".") || /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(url.hostname)) return null;
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

/** Validação usada no cadastro administrativo. */
export function requirePublicHttpsUrl(raw: unknown, field: string): string | null {
  const value = trimmed(raw, 1000);
  if (!value) return null;
  if (value.length > 1000) throw new BadRequestException(`${field} é longo demais.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException(`${field} inválido. Use um link HTTPS.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new BadRequestException(`${field} inválido. Use um link HTTPS.`);
  }
  if (!url.hostname.includes(".")) throw new BadRequestException(`${field} inválido. Use um link HTTPS.`);
  return url.toString();
}

/** Leitura defensiva: dado inválido no banco nunca publica link inseguro. */
export function safePublicHttpsUrl(raw: unknown): string | null {
  try {
    return requirePublicHttpsUrl(raw, "Link público");
  } catch {
    return null;
  }
}

export function storefrontUrls(baseUrl: string, itemId?: string | null) {
  const base = normalizeStorefrontSiteUrl(baseUrl);
  if (!base) return { listUrl: null as string | null, itemUrl: null as string | null };
  const listUrl = `${base}/servicos/`;
  const id = typeof itemId === "string" && UUID_PATTERN.test(itemId) ? itemId : null;
  return { listUrl, itemUrl: id ? `${listUrl}${id}/` : null };
}

export function storefrontShareText(
  baseUrl: string | null,
  itemName?: string | null,
  itemId?: string | null,
): string {
  const { listUrl, itemUrl } = baseUrl ? storefrontUrls(baseUrl, itemId) : { listUrl: null, itemUrl: null };
  if (itemName && itemId && itemUrl) {
    return [
      `Segue o serviço ${itemName} na vitrine da Véxora:`,
      itemUrl,
      "",
      STOREFRONT_NOTICE,
    ].join("\n");
  }
  if (listUrl) {
    return [
      "Segue o catálogo completo de serviços na vitrine da Véxora:",
      listUrl,
      "",
      STOREFRONT_NOTICE,
    ].join("\n");
  }
  return "A vitrine pública ainda não tem uma URL HTTPS configurada. Configure o site do Catálogo antes de enviar o link.";
}

export const isStorefrontItemId = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);
