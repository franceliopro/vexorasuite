import rawSnapshot from "../data/catalog.json";

export type CatalogStatus = "READY" | "NOT_CONFIGURED" | "UNAVAILABLE";

export type CatalogItem = {
  id: string;
  kind: string;
  name: string;
  sku: string;
  priceCents: number;
  currency: string;
  unit: string;
  category: string;
  publicDescription: string;
  publicImageUrl: string | null;
  publicLink: string | null;
  updatedAt: string;
};

export type CatalogSnapshot = {
  status: CatalogStatus;
  source: string;
  generatedAt: string | null;
  notice: string;
  count: number;
  items: CatalogItem[];
  error?: string;
};

export const STOREFRONT_NOTICE =
  "Preços e disponibilidade vêm do catálogo ativo da Véxora. Esta vitrine não confirma pagamento, pedido ou conexão com provedor.";

/** O snapshot é gerado por scripts/fetch-catalog.mjs com whitelist explícita. */
export const catalog = rawSnapshot as unknown as CatalogSnapshot;

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function isSafeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2000) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    if (/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSafeCatalogItem(value: unknown): value is CatalogItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<CatalogItem>;
  return (
    typeof item.id === "string" &&
    SAFE_ID.test(item.id) &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    Number.isSafeInteger(item.priceCents) &&
    (item.priceCents as number) >= 0
  );
}

export const readyItems: CatalogItem[] =
  catalog.status === "READY" && Array.isArray(catalog.items)
    ? catalog.items.filter(isSafeCatalogItem)
    : [];

export const catalogAvailable = readyItems.length > 0;

export function findCatalogItem(id: string): CatalogItem | undefined {
  if (!SAFE_ID.test(id)) return undefined;
  return readyItems.find((item) => item.id === id);
}

export function itemPath(id: string): string {
  return `/servicos/${encodeURIComponent(id)}/`;
}

export function proposalHref(item: CatalogItem): string | null {
  return isSafeHttpsUrl(item.publicLink);
}

export function publicImageHref(item: CatalogItem): string | null {
  return isSafeHttpsUrl(item.publicImageUrl);
}

const safeCurrency = (value: string) => (/^[A-Z]{3}$/.test(value) ? value : "BRL");

export function formatPrice(priceCents: number, currency: string): string {
  const code = safeCurrency(currency);
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: code,
    }).format(priceCents / 100);
  } catch {
    return `R$ ${(priceCents / 100).toFixed(2).replace(".", ",")}`;
  }
}

export function safeLastmod(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

export function groupByCategory(items: CatalogItem[] = readyItems): Array<{ category: string; items: CatalogItem[] }> {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([category, group]) => ({ category, items: group }));
}

export function catalogStateMessage(): string {
  if (readyItems.length > 0) return STOREFRONT_NOTICE;
  if (catalog.status === "READY") return "Nenhum serviço está disponível nesta vitrine no momento.";
  if (catalog.status === "NOT_CONFIGURED") {
    return "Os serviços ainda não foram disponibilizados nesta vitrine.";
  }
  return "Não foi possível carregar os serviços agora. Tente novamente mais tarde.";
}
