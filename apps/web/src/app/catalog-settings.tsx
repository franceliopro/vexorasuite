"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Package as PackageIcon, Plus, X } from "lucide-react";
import { CatalogImagePicker, safeCatalogImageUrl } from "./catalog-image-picker";
import { useModalDialog } from "../lib/use-modal-dialog";

type Kind = "PRODUCT" | "SERVICE";
type CatalogItem = {
  id: string;
  kind: Kind;
  name: string;
  description: string;
  sku: string | null;
  priceCents: number;
  currency: string;
  unit: string;
  imageUrl: string | null;
  publicDescription: string | null;
  publicImageUrl: string | null;
  publicLink: string | null;
  category: string | null;
  active: boolean;
};
type Draft = {
  kind: Kind;
  name: string;
  description: string;
  sku: string;
  price: string;
  currency: string;
  unit: string;
  imageUrl: string;
  publicDescription: string;
  publicImageUrl: string;
  publicLink: string;
  active: boolean;
  category: string;
};
type StorefrontToken = {
  id: string;
  name: string;
  siteUrl: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
type CreatedStorefrontToken = { id: string; name: string; siteUrl: string | null; createdAt: string; token: string; warning: string };
type TokenDraft = { name: string; siteUrl: string };

/** Plataforma de pagamento é escolhida uma vez por empresa; o catálogo é compartilhado por todas. */
type FinanceProviderState = {
  selected: string;
  options: { provider: string; label: string; environment: string | null; verification: { status: string; note: string } }[];
  note: string;
};

/** Opções canônicas do seletor compacto; a disponibilidade real vem de GET /finance/catalog-provider. */
const CATALOG_PAYMENT_PROVIDERS = [
  { provider: "ASAAS", label: "Asaas" },
  { provider: "INFINITEPAY", label: "InfinitePay" },
  { provider: "STRIPE", label: "Stripe" },
];

/** Ações da fatia de publicação. A ordem aqui é só de exibição; o estado vem da API. */
const PUBLICATION_PROVIDERS = [
  { provider: "ASAAS", label: "Asaas", verb: "Publicar no Asaas" },
  { provider: "STRIPE", label: "Stripe", verb: "Publicar na Stripe" },
  { provider: "INFINITEPAY", label: "InfinitePay", verb: "Publicar na InfinitePay" },
] as const;
type PublicationProvider = (typeof PUBLICATION_PROVIDERS)[number]["provider"];

type PublicationProviderState = {
  provider: string;
  label: string;
  environment: string | null;
  configured: boolean;
  capability: string;
  status: string;
  objectType: string;
  externalId: string | null;
  externalUrl: string | null;
  lastError: string | null;
  publishedAt: string | null;
  importedAt: string | null;
  canPublish: boolean;
  note: string;
};
type PublicationStatus = { itemId: string; itemName: string; notice: string; providers: PublicationProviderState[] };
type PublicationResult = PublicationProviderState & { alreadyPublished: boolean; notice: string };
type ImportCandidate = {
  externalId: string;
  name: string;
  description: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
  alreadyImported: boolean;
};
type ImportPreview = {
  provider: string;
  source: string;
  environment?: string | null;
  hasMore?: boolean;
  note: string;
  candidates: ImportCandidate[];
};
type ImportResult = { imported: boolean; itemId: string | null; status: string; externalId: string; notice: string };

const PUBLICATION_STATUS_LABELS: Record<string, string> = {
  NOT_PUBLISHED: "Não publicado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Objeto confirmado",
  PARTIAL: "Parcial",
  FAILED: "Falhou",
  IMPORTED: "Importado",
};

/** ASAAS é a categoria legada que faz o item aparecer nas listagens do Asaas e em Nova assinatura. */
const emptyDraft = (): Draft => ({ kind: "SERVICE", name: "", description: "", sku: "", price: "", currency: "BRL", unit: "un", imageUrl: "", publicDescription: "", publicImageUrl: "", publicLink: "", active: true, category: "ASAAS" });

/** Validação local apenas para avisar antes de enviar; o servidor continua validando a URL HTTPS. */
const isHttpsUrl = (value: string): boolean => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

/** A prévia só deriva de uma URL HTTPS configurada; nunca inventamos domínio. */
function storefrontListUrl(siteUrl: string | null | undefined): string {
  if (!siteUrl) return "";
  try {
    const url = new URL(siteUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return "";
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/servicos/`;
  } catch { return ""; }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Falha ao carregar o catálogo.");
  return data as T;
}

const cardTw = "grid w-full min-w-0 gap-4 self-start rounded-token border border-gray-200 bg-zinc-200 p-pad";
const headingTw = "mb-1 flex min-w-0 items-center gap-3";
const headingTitleTw = "m-0 text-asaas-title font-extrabold text-ink";
const headingCopyTw = "mt-0.5 text-small text-ink-secondary";
const feedbackErrorTw = "rounded-token-sm border border-red-600 bg-red-100 px-3 py-2.5 text-small text-red-600";
const feedbackSuccessTw = "rounded-token-sm border border-emerald-600 bg-emerald-100 px-3 py-2.5 text-small text-emerald-600";
const toolbarTw = "grid grid-cols-1 gap-3 sm:grid-cols-2";
const formTw = "grid gap-3 rounded-token-sm border border-gray-200 bg-zinc-100 p-3";
const formGridTw = "grid grid-cols-1 gap-3 md:grid-cols-2";
const fieldTw = "grid gap-1.5 text-asaas-label font-semibold text-ink-secondary";
const inputTw = "min-h-control w-full min-w-0 rounded-lg border border-gray-200 bg-zinc-100 px-2.5 py-1.5 text-small text-ink focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25";
const primaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-ink transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const noteTw = "m-0 text-small text-ink-secondary";
const summaryTw = "grid grid-cols-2 gap-2 sm:grid-cols-4";
const summaryItemTw = "grid gap-0.5 rounded-token-sm border border-gray-200 bg-zinc-100 px-3 py-2";
const summaryLabelTw = "text-2xs font-bold uppercase tracking-wide text-slate-500";
const summaryValueTw = "text-h4 font-extrabold tabular-nums text-ink";
const catalogGridTw = "grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3";
const catalogCardTw = "grid h-128 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-token border border-gray-200 bg-zinc-100 p-3 transition-[height,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-token focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const catalogCardExpandedTw = "h-168";
const coverFrameTw = "relative grid aspect-video w-full place-items-center overflow-hidden rounded-token-sm border border-gray-200 bg-zinc-200";
const coverImageTw = "absolute inset-2 m-auto size-auto max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)] object-contain";
const cardCopyTw = "grid min-h-0 content-start gap-1.5 overflow-y-auto";
const cardDescriptionTw = "m-0 line-clamp-2 text-small leading-relaxed text-slate-600";
const cardDescriptionExpandedTw = "m-0 text-small leading-relaxed text-slate-600";
const cardBadgeTw = "inline-flex w-fit items-center rounded-fin-chip bg-blue-50 px-2 text-2xs font-bold text-blue-700";
const cardMetaTw = "inline-flex w-fit items-center rounded-fin-chip bg-zinc-200 px-2 text-2xs font-bold text-slate-700";
const cardDetailTw = "grid gap-1 rounded-token-sm border border-gray-200 bg-zinc-100 p-2 text-2xs leading-relaxed text-slate-600";
const cardDetailRowTw = "flex min-w-0 gap-1";
const cardDetailLabelTw = "min-w-0 flex-none font-bold text-slate-700";
const cardDetailValueTw = "m-0 min-w-0 break-all text-slate-600";
const cardClampTw = "line-clamp-1";
const cardPriceTw = "text-small font-extrabold tabular-nums text-ink";
const subtleButtonTw = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-token-sm border border-gray-200 bg-zinc-200 px-2.5 text-2xs font-bold text-ink transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const emptyPanelTw = "rounded-token border border-dashed border-gray-300 bg-zinc-100 p-5 text-center text-small text-slate-600";
const compactProviderTw = "grid gap-3 rounded-token-sm border border-gray-200 bg-zinc-100 p-3 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:items-center";
const detailsSummaryTw = "cursor-pointer list-none text-asaas-label font-extrabold text-ink transition-colors hover:text-blue-700";
const modalBackdropTw = "fixed inset-0 z-wizard grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5";
const modalPanelTw = "relative grid max-h-dvh w-full max-w-4xl content-start gap-3 overflow-y-auto rounded-token border border-gray-200 bg-zinc-100 p-4 shadow-token-lg sm:p-5";

export function CatalogSettings({ canManage, initialItemId = "", backLabel = "Voltar às Configurações", onBack }: { canManage: boolean; initialItemId?: string; backLabel?: string; onBack: () => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [financeProvider, setFinanceProvider] = useState<FinanceProviderState | null>(null);
  const [financeBusy, setFinanceBusy] = useState(false);
  const [tokens, setTokens] = useState<StorefrontToken[]>([]);
  const [tokenDrafts, setTokenDrafts] = useState<Record<string, TokenDraft>>({});
  const [tokenName, setTokenName] = useState("");
  const [tokenSiteUrl, setTokenSiteUrl] = useState("");
  const [createdToken, setCreatedToken] = useState<CreatedStorefrontToken | null>(null);
  const [storefrontBusy, setStorefrontBusy] = useState(false);
  const [storefrontError, setStorefrontError] = useState("");
  const [storefrontNotice, setStorefrontNotice] = useState("");
  const [publicationItemId, setPublicationItemId] = useState("");
  const [publication, setPublication] = useState<PublicationStatus | null>(null);
  const [publicationBusy, setPublicationBusy] = useState<PublicationProvider | "">("");
  const [pendingPublish, setPendingPublish] = useState<PublicationProvider | "">("");
  const [publicationError, setPublicationError] = useState("");
  const [publicationNotice, setPublicationNotice] = useState("");
  const [importProvider, setImportProvider] = useState<PublicationProvider>("ASAAS");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportCandidate | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const appliedEditId = useRef("");
  const gridRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);

  useModalDialog(formOpen, modalRef, () => { if (!busy) setFormOpen(false); });

  async function load() {
    try {
      const data = await api<{ items?: CatalogItem[] }>("/api/backend/catalog?limit=200&includeInactive=true");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o catálogo.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFinanceProvider() {
    try {
      setFinanceProvider(await api<FinanceProviderState>("/api/backend/finance/catalog-provider"));
    } catch (e) {
      setFinanceProvider(null);
    }
  }

  async function loadStorefront() {
    if (!canManage) return;
    try {
      const data = await api<{ tokens?: StorefrontToken[] }>("/api/backend/storefront/tokens");
      const list = Array.isArray(data.tokens) ? data.tokens : [];
      setTokens(list);
      setTokenDrafts(Object.fromEntries(list.map((token) => [token.id, { name: token.name, siteUrl: token.siteUrl || "" }])));
    } catch (e) {
      setStorefrontError(e instanceof Error ? e.message : "Falha ao carregar as vitrines.");
    }
  }

  async function saveFinanceProvider(provider: string) {
    if (!canManage || financeBusy) return;
    setFinanceBusy(true);
    try {
      const updated = await api<FinanceProviderState>("/api/backend/finance/catalog-provider", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }),
      });
      setFinanceProvider(updated);
      setNotice("Plataforma de pagamento do catálogo atualizada. Nenhuma cobrança foi criada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar a plataforma de pagamento.");
    } finally {
      setFinanceBusy(false);
    }
  }

  async function createStorefrontToken() {
    if (!canManage || storefrontBusy) return;
    const name = tokenName.trim();
    const siteUrl = tokenSiteUrl.trim();
    if (name.length < 2) { setStorefrontError("Informe um nome com pelo menos 2 caracteres."); return; }
    if (siteUrl && !isHttpsUrl(siteUrl)) { setStorefrontError("URL da vitrine inválida. Use um link HTTPS."); return; }
    setStorefrontBusy(true);
    setStorefrontError("");
    setStorefrontNotice("");
    try {
      const created = await api<CreatedStorefrontToken>("/api/backend/storefront/tokens", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, siteUrl }),
      });
      setCreatedToken(created);
      setTokenName("");
      setTokenSiteUrl("");
      setStorefrontNotice("Token criado. Ter token ou URL não prova que o site está publicado ou conectado.");
      await loadStorefront();
    } catch (e) {
      setStorefrontError(e instanceof Error ? e.message : "Falha ao criar a vitrine.");
    } finally {
      setStorefrontBusy(false);
    }
  }

  async function updateStorefrontToken(id: string) {
    if (!canManage || storefrontBusy) return;
    const draftToken = tokenDrafts[id];
    if (!draftToken) return;
    const name = draftToken.name.trim();
    const siteUrl = draftToken.siteUrl.trim();
    if (name.length < 2) { setStorefrontError("Informe um nome com pelo menos 2 caracteres."); return; }
    if (siteUrl && !isHttpsUrl(siteUrl)) { setStorefrontError("URL da vitrine inválida. Use um link HTTPS."); return; }
    setStorefrontBusy(true);
    setStorefrontError("");
    setStorefrontNotice("");
    try {
      await api(`/api/backend/storefront/tokens/${encodeURIComponent(id)}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, siteUrl }),
      });
      setStorefrontNotice("Vitrine atualizada. Nenhuma publicação foi alterada.");
      await loadStorefront();
    } catch (e) {
      setStorefrontError(e instanceof Error ? e.message : "Falha ao atualizar a vitrine.");
    } finally {
      setStorefrontBusy(false);
    }
  }

  async function revokeStorefrontToken(id: string) {
    if (!canManage || storefrontBusy) return;
    setStorefrontBusy(true);
    setStorefrontError("");
    setStorefrontNotice("");
    try {
      await api(`/api/backend/storefront/tokens/${encodeURIComponent(id)}`, { method: "DELETE" });
      setStorefrontNotice("Token revogado. Nenhum site foi despublicado por esta ação.");
      await loadStorefront();
    } catch (e) {
      setStorefrontError(e instanceof Error ? e.message : "Falha ao revogar o token.");
    } finally {
      setStorefrontBusy(false);
    }
  }

  async function loadPublication(itemId = publicationItemId) {
    if (!itemId) return;
    try {
      setPublication(await api<PublicationStatus>(`/api/backend/catalog/publications/${encodeURIComponent(itemId)}`));
    } catch (e) {
      setPublication(null);
      setPublicationError(e instanceof Error ? e.message : "Falha ao consultar as publicações do item.");
    }
  }

  function askPublish(provider: PublicationProvider) {
    if (!canManage || !publicationItemId || publicationBusy) return;
    setPublicationError("");
    setPublicationNotice("");
    setPendingPublish(provider);
  }

  async function confirmPublish() {
    if (!canManage || !publicationItemId || !pendingPublish || publicationBusy) return;
    const provider = pendingPublish;
    setPublicationBusy(provider);
    setPublicationError("");
    setPublicationNotice("");
    try {
      const result = await api<PublicationResult>(`/api/backend/catalog/publications/${encodeURIComponent(publicationItemId)}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, confirm: true }),
      });
      setPendingPublish("");
      setPublicationNotice(result.notice || "Publicação registrada.");
      await loadPublication(publicationItemId);
    } catch (e) {
      setPublicationError(e instanceof Error ? e.message : "A plataforma não confirmou a publicação.");
    } finally {
      setPublicationBusy("");
    }
  }

  async function loadImportPreview(provider: PublicationProvider) {
    if (!canManage) return;
    setImportBusy(true);
    setImportError("");
    setImportNotice("");
    setPendingImport(null);
    try {
      setImportPreview(await api<ImportPreview>(`/api/backend/catalog/publications/import/preview?provider=${encodeURIComponent(provider)}&limit=50`));
    } catch (e) {
      setImportPreview(null);
      setImportError(e instanceof Error ? e.message : "Falha ao consultar os itens da plataforma.");
    } finally {
      setImportBusy(false);
    }
  }

  async function confirmImport() {
    if (!canManage || !pendingImport || importBusy) return;
    const candidate = pendingImport;
    setImportBusy(true);
    setImportError("");
    setImportNotice("");
    try {
      const result = await api<ImportResult>("/api/backend/catalog/publications/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: importProvider, externalId: candidate.externalId, confirm: true }),
      });
      setPendingImport(null);
      setImportNotice(result.notice || "Item importado para o catálogo.");
      if (result.itemId) setPublicationItemId(result.itemId);
      await Promise.all([load(), loadImportPreview(importProvider)]);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "A plataforma não confirmou a importação.");
    } finally {
      setImportBusy(false);
    }
  }

  useEffect(() => { void load(); void loadFinanceProvider(); void loadStorefront(); }, []);
  useEffect(() => {
    if (!publicationItemId && items[0]) setPublicationItemId(items[0].id);
  }, [items, publicationItemId]);
  useEffect(() => {
    setPendingPublish("");
    setPublicationError("");
    setPublicationNotice("");
    if (publicationItemId) void loadPublication(publicationItemId);
  }, [publicationItemId]);
  useEffect(() => {
    if (!expandedId) return;
    const collapseOutside = (event: MouseEvent) => {
      if (event.target instanceof Element && gridRef.current?.contains(event.target)) return;
      setExpandedId("");
    };
    document.addEventListener("mousedown", collapseOutside);
    return () => document.removeEventListener("mousedown", collapseOutside);
  }, [expandedId]);
  useEffect(() => {
    if (!initialItemId || appliedEditId.current === initialItemId) return;
    const item = items.find((entry) => entry.id === initialItemId);
    if (!item) return;
    appliedEditId.current = initialItemId;
    setEditingId(item.id);
    setDraft({
      kind: item.kind,
      name: item.name,
      description: item.description || "",
      sku: item.sku || "",
      price: (item.priceCents / 100).toFixed(2).replace(".", ","),
      currency: item.currency || "BRL",
      unit: item.unit || "un",
      imageUrl: item.imageUrl || "",
      publicDescription: item.publicDescription || "",
      publicImageUrl: item.publicImageUrl || "",
      publicLink: item.publicLink || "",
      active: item.active !== false,
      category: item.category || "ASAAS",
    });
    setFormOpen(true);
    setError("");
    setNotice("");
  }, [initialItemId, items]);

  function openNew() {
    if (!canManage) return;
    appliedEditId.current = "";
    setEditingId(null);
    setDraft(emptyDraft());
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function startEdit(item: CatalogItem) {
    if (!canManage) return;
    appliedEditId.current = item.id;
    setEditingId(item.id);
    setDraft({
      kind: item.kind,
      name: item.name,
      description: item.description || "",
      sku: item.sku || "",
      price: (item.priceCents / 100).toFixed(2).replace(".", ","),
      currency: item.currency || "BRL",
      unit: item.unit || "un",
      imageUrl: item.imageUrl || "",
      publicDescription: item.publicDescription || "",
      publicImageUrl: item.publicImageUrl || "",
      publicLink: item.publicLink || "",
      active: item.active !== false,
      category: item.category || "ASAAS",
    });
    setFormOpen(true);
    setExpandedId("");
    setError("");
    setNotice("");
  }

  function resetDraft() {
    setDraft(emptyDraft());
    setEditingId(null);
  }

  async function save() {
    if (!canManage) return;
    const name = draft.name.trim();
    const price = Number(draft.price.trim().replace(",", "."));
    if (name.length < 2) { setError("Informe um nome com pelo menos 2 caracteres."); return; }
    if (!Number.isFinite(price) || price < 0) { setError("Informe um preço válido."); return; }
    const publicImageUrl = draft.publicImageUrl.trim();
    const publicLink = draft.publicLink.trim();
    if (publicImageUrl && !isHttpsUrl(publicImageUrl)) { setError("Imagem pública da vitrine: use um link HTTPS."); return; }
    if (publicLink && !isHttpsUrl(publicLink)) { setError("Link público de solicitação de proposta: use um link HTTPS."); return; }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        kind: draft.kind,
        name,
        description: draft.description.trim(),
        sku: draft.sku.trim(),
        priceCents: Math.round(price * 100),
        currency: (draft.currency.trim().toUpperCase() || "BRL").slice(0, 3),
        unit: draft.unit.trim() || "un",
        imageUrl: safeCatalogImageUrl(draft.imageUrl),
        publicDescription: draft.publicDescription.trim(),
        publicImageUrl: draft.publicImageUrl.trim(),
        publicLink: draft.publicLink.trim(),
        active: draft.active,
        category: draft.category.trim() || "ASAAS",
      };
      if (editingId) await api(`/api/backend/catalog/${encodeURIComponent(editingId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      else await api("/api/backend/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setFormOpen(false);
      setNotice(editingId ? "Item atualizado. Novos documentos usarão os dados atuais." : "Item adicionado ao catálogo da empresa.");
      resetDraft();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar o item.");
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = tokens.map((token) => (token.revokedAt ? "" : storefrontListUrl(token.siteUrl))).find(Boolean) || "";

  return <section data-testid="catalog-settings" className={cardTw} aria-labelledby="catalog-settings-title">
    <div className={headingTw}>
      <div>
        <h2 id="catalog-settings-title" className={headingTitleTw}>Catálogo da empresa</h2>
        <p className={headingCopyTw}>Produtos e serviços usados no atendimento, nos documentos e, de forma aprovada, na vitrine externa.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? <button type="button" className={secondaryButton} data-testid="catalog-settings-new" disabled={busy} onClick={openNew}><Plus size={15} aria-hidden="true" /> Novo item</button> : null}
        <button type="button" className={subtleButtonTw} disabled={busy} onClick={onBack}>{backLabel}</button>
      </div>
    </div>
    <div className={summaryTw} data-testid="catalog-settings-summary">
      <div className={summaryItemTw}><span className={summaryLabelTw}>Itens</span><strong className={summaryValueTw}>{items.length}</strong></div>
      <div className={summaryItemTw}><span className={summaryLabelTw}>Ativos</span><strong className={summaryValueTw}>{items.filter((item) => item.active).length}</strong></div>
      <div className={summaryItemTw}><span className={summaryLabelTw}>Com descrição pública</span><strong className={summaryValueTw}>{items.filter((item) => !!item.publicDescription).length}</strong></div>
      <div className={summaryItemTw}><span className={summaryLabelTw}>Com link aprovado</span><strong className={summaryValueTw}>{items.filter((item) => !!item.publicLink).length}</strong></div>
    </div>
    {error ? <div className={feedbackErrorTw} role="alert">{error}</div> : null}
    {notice ? <div className={feedbackSuccessTw} role="status">{notice}</div> : null}
    {!canManage ? <div className={feedbackErrorTw} role="note">Somente OWNER e ADMIN podem alterar o catálogo.</div> : null}
    {loading && initialItemId ? <p className={noteTw}>Carregando item do catálogo…</p> : null}
    {loading && !items.length ? <p className={noteTw} role="status">Carregando catálogo…</p> : null}
    {!loading && !items.length ? <div className={emptyPanelTw}>Nenhum item cadastrado nesta empresa. Use “Novo item” para adicionar o primeiro.</div> : null}
    {items.length ? <div ref={gridRef} className={catalogGridTw} data-testid="catalog-settings-cards" data-expanded={expandedId ? "true" : "false"}>
      {items.map((item) => {
        const image = safeCatalogImageUrl(item.imageUrl || "");
        const expanded = expandedId === item.id;
        return <article key={item.id} role="button" tabIndex={0} aria-expanded={expanded} aria-label={`Cartão de ${item.name}`} className={`${catalogCardTw} ${expanded ? catalogCardExpandedTw : ""}`} onClick={() => setExpandedId(expanded ? "" : item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setExpandedId(expanded ? "" : item.id); } }}>
          <div className={coverFrameTw}>{image ? <img className={coverImageTw} src={image} alt={`Capa de ${item.name}`} /> : <PackageIcon size={32} aria-hidden="true" />}</div>
          <div className={cardCopyTw}>
            <div className="flex flex-wrap items-center gap-1.5"><span className={cardBadgeTw} data-kind={item.kind}>{item.kind === "PRODUCT" ? "Produto digital" : "Serviço"}</span><span className={item.active ? cardBadgeTw : cardMetaTw}>{item.active ? "Ativo" : "Inativo"}</span>{item.category ? <span className={cardMetaTw}>{item.category}</span> : null}</div>
            <h3 className="m-0 text-body font-extrabold text-ink">{item.name}</h3>
            <small className="text-2xs font-bold uppercase tracking-wide text-slate-500">Descrição interna (somente na gestão)</small>
            <p className={expanded ? cardDescriptionExpandedTw : cardDescriptionTw}>{item.description || "Sem descrição interna cadastrada."}</p>
            <div className={cardDetailTw} data-testid="catalog-settings-card-details">
              <div className={cardDetailRowTw}><span className={cardDetailLabelTw}>SKU:</span><span className={cardDetailValueTw}>{item.sku || "—"}</span></div>
              <div className={cardDetailRowTw}><span className={cardDetailLabelTw}>Unidade:</span><span className={cardDetailValueTw}>{item.unit || "un"}</span></div>
              <div className={cardDetailRowTw}><span className={cardDetailLabelTw}>Categoria:</span><span className={cardDetailValueTw}>{item.category || "—"}</span></div>
              <div className={cardDetailRowTw}><span className={cardDetailLabelTw}>Situação:</span><span className={cardDetailValueTw}>{item.active ? "Ativo" : "Inativo"}</span></div>
              <div className="grid gap-0.5"><span className={cardDetailLabelTw}>Descrição pública da vitrine (campo separado):</span><p className={`m-0 ${expanded ? "" : cardClampTw}`}>{item.publicDescription || "Não informada. A descrição interna não é enviada à vitrine."}</p></div>
              <div className={cardDetailRowTw}><span className={cardDetailLabelTw}>Imagem pública:</span><span className={`${cardDetailValueTw} ${expanded ? "" : cardClampTw}`}>{item.publicImageUrl || "—"}</span></div>
              <div className={cardDetailRowTw}><span className={cardDetailLabelTw}>Link público:</span><span className={`${cardDetailValueTw} ${expanded ? "" : cardClampTw}`}>{item.publicLink || "—"}</span></div>
              {expanded ? <div className={cardDetailRowTw}><span className={cardDetailLabelTw}>Imagem interna:</span><span className={cardDetailValueTw}>{item.imageUrl || "—"} (não enviada à vitrine)</span></div> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className={cardPriceTw}>{(item.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: item.currency || "BRL" })}</strong>
            <button type="button" className={subtleButtonTw} onClick={(event) => { event.stopPropagation(); startEdit(item); }} onKeyDown={(event) => event.stopPropagation()}>Editar</button>
          </div>
        </article>;
      })}
    </div> : null}
    <section data-testid="catalog-settings-finance-provider" className={compactProviderTw} aria-labelledby="catalog-finance-title">
      <label className={fieldTw}>
        <span id="catalog-finance-title" className="text-asaas-label font-extrabold text-ink">Plataforma de pagamento preferida</span>
        <select className={inputTw} aria-label="Sistema financeiro do catálogo" value={financeProvider?.selected || "ASAAS"} disabled={!canManage || financeBusy || !financeProvider} onChange={(event) => void saveFinanceProvider(event.target.value)}>
          {CATALOG_PAYMENT_PROVIDERS.map(({ provider, label }) => <option key={provider} value={provider}>{label}{financeProvider && !financeProvider.options.some((option) => option.provider === provider) ? " (não configurada)" : ""}</option>)}
        </select>
      </label>
      <div className="grid gap-1">
        <p className={noteTw}>Preferência tenant-scoped do catálogo: um catálogo para todas as plataformas. Salvar não cria cobrança nem prova conexão ativa, e nenhuma credencial é copiada para cá — configure cada plataforma em Conexões.</p>
        {financeProvider ? <p className={noteTw}>{financeProvider.note}</p> : <p className={noteTw}>Não foi possível consultar as plataformas configuradas nesta empresa.</p>}
        {financeProvider && financeProvider.options.length === 0 ? <p className={feedbackErrorTw} role="note">Nenhuma plataforma está habilitada e configurada nesta empresa. Configure em Conexões antes de escolher.</p> : null}
      </div>
    </section>
    <details data-testid="catalog-settings-publication" className={formTw} aria-labelledby="catalog-publication-title">
      <summary className={detailsSummaryTw}><h3 id="catalog-publication-title" className={headingTitleTw}>Publicação por plataforma</h3></summary>
      <p className={headingCopyTw}>O catálogo continua único. Cada publicação cria um espelho explícito na plataforma escolhida; nenhum link, cobrança ou pedido é inventado.</p>
      {publicationError ? <div className={feedbackErrorTw} role="alert" data-testid="catalog-publication-error">{publicationError}</div> : null}
      {publicationNotice ? <div className={feedbackSuccessTw} role="status" data-testid="catalog-publication-notice">{publicationNotice}</div> : null}
      <div className={toolbarTw}>
        <label className={fieldTw}>
          <span>Item do catálogo</span>
          <select className={inputTw} data-testid="catalog-publication-item" value={publicationItemId} disabled={!items.length || publicationBusy !== ""} onChange={(event) => setPublicationItemId(event.target.value)}>
            {items.length ? items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">Nenhum item cadastrado</option>}
          </select>
        </label>
        <p className={noteTw}>{publication?.notice || "Publicar cria um objeto real na plataforma. Configuração salva, token ou link não provam que a vitrine está no ar."}</p>
      </div>
      {publication ? <div className="grid gap-2" data-testid="catalog-publication-status">
        {PUBLICATION_PROVIDERS.map(({ provider, label, verb }) => {
          const state = publication.providers.find((entry) => entry.provider === provider);
          const status = state?.status || "NOT_PUBLISHED";
          return <div key={provider} className="grid gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-2" data-provider={provider} data-status={status}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid min-w-0 gap-0.5">
                <strong className="text-small font-extrabold text-ink">{label}</strong>
                <small className="text-2xs text-slate-600">{state?.capability || "CAPACIDADE_NÃO_INFORMADA"} · {state?.environment || "ambiente não informado"}</small>
              </div>
              <span className={status === "PUBLISHED" ? cardBadgeTw : cardMetaTw}>{PUBLICATION_STATUS_LABELS[status] || status}</span>
            </div>
            <p className={noteTw}>{state?.note || ""}</p>
            {state?.externalUrl ? <p className={noteTw}><a className="font-bold text-blue-600 underline" href={state.externalUrl} target="_blank" rel="noopener noreferrer">Abrir link confirmado pela plataforma</a></p> : null}
            {state?.lastError ? <p className={feedbackErrorTw} role="note">{state.lastError}</p> : null}
            {canManage ? <div className="flex flex-wrap gap-2"><button type="button" className={subtleButtonTw} data-testid={`catalog-publish-${provider.toLowerCase()}`} disabled={publicationBusy !== "" || !state?.canPublish} onClick={() => askPublish(provider)}>{verb}</button></div> : null}
          </div>;
        })}
      </div> : <p className={noteTw}>Consultando o estado das plataformas para este item…</p>}
      {pendingPublish ? <div className={feedbackSuccessTw} role="note" data-testid="catalog-publication-confirm">
        <p className="m-0">Confirme: esta ação criará um objeto real na plataforma selecionada. Nenhuma cobrança, pedido ou envio será executado.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={subtleButtonTw} disabled={publicationBusy !== ""} onClick={() => void confirmPublish()}>Confirmar publicação</button>
          <button type="button" className={subtleButtonTw} disabled={publicationBusy !== ""} onClick={() => setPendingPublish("")}>Cancelar</button>
        </div>
      </div> : null}
      <div className={formTw} data-testid="catalog-publication-import">
        <h4 className="m-0 text-small font-extrabold text-ink">Importar itens criados nas plataformas</h4>
        <p className={noteTw}>A importação traz apenas dados básicos. Descrição pública, imagem pública, link público, SKU, unidade e categoria continuam sendo preenchidos na Véxora.</p>
        <div className={toolbarTw}>
          <label className={fieldTw}>
            <span>Plataforma de origem</span>
            <select className={inputTw} data-testid="catalog-import-provider" value={importProvider} disabled={importBusy} onChange={(event) => { setImportProvider(event.target.value as PublicationProvider); setImportPreview(null); }}>
              {PUBLICATION_PROVIDERS.map(({ provider, label }) => <option key={provider} value={provider}>{label}</option>)}
            </select>
          </label>
          <div className="flex items-end"><button type="button" className={subtleButtonTw} disabled={!canManage || importBusy} onClick={() => void loadImportPreview(importProvider)}>Buscar itens</button></div>
        </div>
        {importError ? <div className={feedbackErrorTw} role="alert">{importError}</div> : null}
        {importNotice ? <div className={feedbackSuccessTw} role="status">{importNotice}</div> : null}
        {importPreview ? <div className="grid gap-2">
          <p className={noteTw} data-testid="catalog-import-source">{importPreview.note}</p>
          {importPreview.candidates.length ? importPreview.candidates.map((candidate) => <div key={candidate.externalId} className="flex flex-wrap items-center justify-between gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-2">
            <div className="grid min-w-0 gap-0.5">
              <strong className="text-small font-bold text-ink">{candidate.name}</strong>
              <small className="text-2xs text-slate-600">{candidate.externalId} · {candidate.priceCents !== null ? (candidate.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: candidate.currency || "BRL" }) : "sem preço"}</small>
            </div>
            <button type="button" className={subtleButtonTw} disabled={!canManage || importBusy || candidate.alreadyImported} data-testid="catalog-import-candidate" onClick={() => { setImportError(""); setImportNotice(""); setPendingImport(candidate); }}>{candidate.alreadyImported ? "Já catalogado" : "Importar"}</button>
          </div>) : <p className={noteTw}>Nenhum item disponível para importação nesta origem.</p>}
        </div> : null}
        {pendingImport ? <div className={feedbackSuccessTw} role="note" data-testid="catalog-import-confirm">
          <p className="m-0">Confirmar a importação de “{pendingImport.name}” para o catálogo desta empresa?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={subtleButtonTw} disabled={importBusy} onClick={() => void confirmImport()}>Confirmar importação</button>
            <button type="button" className={subtleButtonTw} disabled={importBusy} onClick={() => setPendingImport(null)}>Cancelar</button>
          </div>
        </div> : null}
      </div>
    </details>
    {canManage ? <details data-testid="catalog-settings-storefront" className={formTw} aria-labelledby="catalog-storefront-title">
      <summary className={detailsSummaryTw}><h3 id="catalog-storefront-title" className={headingTitleTw}>Vitrine pública</h3></summary>
      <p className={headingCopyTw}>Token de leitura e URL HTTPS do site da vitrine. Ter token ou URL não significa que o site esteja publicado, no ar ou conectado.</p>
      {storefrontError ? <div className={feedbackErrorTw} role="alert" data-testid="catalog-storefront-error">{storefrontError}</div> : null}
      {storefrontNotice ? <div className={feedbackSuccessTw} role="status" data-testid="catalog-storefront-notice">{storefrontNotice}</div> : null}
      <p className={noteTw} data-testid="catalog-storefront-preview">
        {previewUrl ? <>Prévia configurada: <a className="font-bold text-blue-600 underline" href={previewUrl} target="_blank" rel="noopener noreferrer">{previewUrl}</a>. Confira se o site está no ar antes de compartilhar.</> : "URL da vitrine não configurada. Nenhum link de prévia é exibido."}
      </p>
      <div className={toolbarTw}>
        <label className={fieldTw}><span>Nome da vitrine</span><input className={inputTw} data-testid="catalog-storefront-name" maxLength={80} value={tokenName} placeholder="ex.: Site de serviços" onChange={(event) => setTokenName(event.target.value)} /></label>
        <label className={fieldTw}><span>URL HTTPS do site</span><input className={inputTw} data-testid="catalog-storefront-site-url" maxLength={1000} value={tokenSiteUrl} placeholder="https://www.exemplo.com" onChange={(event) => setTokenSiteUrl(event.target.value)} /></label>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" className={subtleButtonTw} data-testid="catalog-storefront-create" disabled={storefrontBusy} onClick={() => void createStorefrontToken()}>Criar token</button></div>
      {createdToken ? <div className={feedbackSuccessTw} role="status" data-testid="catalog-storefront-created">
        <p className="m-0 break-all">Token único: <code data-testid="catalog-storefront-token-value">{createdToken.token}</code></p>
        <p className="m-0">{createdToken.warning}</p>
      </div> : null}
      {tokens.length ? <div className="grid gap-2">
        {tokens.map((token) => {
          const fields = tokenDrafts[token.id] || { name: token.name, siteUrl: token.siteUrl || "" };
          return <details key={token.id} data-testid="catalog-storefront-token-row" className="rounded-token-sm border border-gray-200 bg-zinc-100 p-2">
            <summary className="cursor-pointer text-small font-bold text-ink">{token.name} · {token.revokedAt ? "Revogado" : "Ativo"}{token.siteUrl ? " · URL configurada" : " · Sem URL"}</summary>
            <div className="grid gap-2 pt-2">
              <p className={noteTw}>Criado em {new Date(token.createdAt).toLocaleString("pt-BR")}{token.lastUsedAt ? ` · Último uso ${new Date(token.lastUsedAt).toLocaleString("pt-BR")}` : ""}</p>
              {token.revokedAt ? <p className={noteTw}>Este token foi revogado e não pode ser usado.</p> : <>
                <div className={toolbarTw}>
                  <label className={fieldTw}><span>Nome da vitrine</span><input className={inputTw} maxLength={80} value={fields.name} onChange={(event) => setTokenDrafts((current) => ({ ...current, [token.id]: { ...fields, name: event.target.value } }))} /></label>
                  <label className={fieldTw}><span>URL HTTPS do site</span><input className={inputTw} maxLength={1000} value={fields.siteUrl} onChange={(event) => setTokenDrafts((current) => ({ ...current, [token.id]: { ...fields, siteUrl: event.target.value } }))} /></label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={subtleButtonTw} disabled={storefrontBusy} onClick={() => void updateStorefrontToken(token.id)}>Salvar vitrine</button>
                  <button type="button" className={subtleButtonTw} disabled={storefrontBusy} data-testid="catalog-storefront-revoke" onClick={() => void revokeStorefrontToken(token.id)}>Revogar token</button>
                </div>
              </>}
            </div>
          </details>;
        })}
      </div> : <p className={noteTw}>Nenhuma vitrine cadastrada nesta empresa.</p>}
    </details> : null}
    {formOpen && canManage ? <div className={modalBackdropTw} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setFormOpen(false); }}>
      <section ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="catalog-settings-form-title" data-testid="catalog-settings-form" className={modalPanelTw}>
        <div className={headingTw}>
          <div>
            <h3 id="catalog-settings-form-title" className={headingTitleTw}>{editingId ? "Editar item do catálogo" : "Novo item do catálogo"}</h3>
            <p className={headingCopyTw}>{editingId ? "Altere os dados e salve para atualizar o Catálogo da empresa." : "Cadastre um produto ou serviço para usar no Catálogo, atendimento e documentos."}</p>
          </div>
          <button type="button" className={subtleButtonTw} aria-label="Fechar" disabled={busy} onClick={() => setFormOpen(false)}><X size={16} aria-hidden="true" /></button>
        </div>
        {error ? <div className={feedbackErrorTw} role="alert">{error}</div> : null}
        {notice ? <div className={feedbackSuccessTw} role="status">{notice}</div> : null}
        <div className={toolbarTw}>
          <label className={fieldTw}><span>Tipo</span><select className={inputTw} value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Kind }))}><option value="SERVICE">Serviço</option><option value="PRODUCT">Produto digital</option></select></label>
          <label className={fieldTw}><span>Nome</span><input className={inputTw} data-testid="catalog-settings-name" maxLength={160} value={draft.name} placeholder="ex.: Site institucional" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        </div>
        <label className={fieldTw}><span>Descrição</span><textarea className={inputTw} maxLength={2000} rows={2} value={draft.description} placeholder="O que está incluído" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /><small className="font-normal">Campo interno da Véxora. Não é enviado à vitrine externa.</small></label>
        <div className={formGridTw}>
          <label className={fieldTw}><span>Preço</span><input className={inputTw} data-testid="catalog-settings-price" inputMode="decimal" maxLength={20} value={draft.price} placeholder="0,00" onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} /></label>
          <label className={fieldTw}><span>Moeda</span><input className={inputTw} maxLength={3} value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))} /></label>
          <label className={fieldTw}><span>Unidade</span><input className={inputTw} maxLength={10} value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} /></label>
          <label className={fieldTw}><span>SKU</span><input className={inputTw} maxLength={80} value={draft.sku} onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))} /></label>
          <label className={fieldTw}><span>Categoria</span><input className={inputTw} maxLength={80} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /><small className="font-normal">Use <strong>ASAAS</strong> para este item aparecer nas listagens do Asaas e em Nova assinatura. O Catálogo serve a todas as plataformas.</small></label>
        </div>
        <div className={fieldTw}>
          <span>Imagem do item</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={secondaryButton} data-testid="catalog-settings-image-picker" onClick={() => setImagePickerOpen(true)}><ImageIcon size={15} aria-hidden="true" /> Escolher imagem</button>
            <span className="min-w-0 break-all text-small text-ink-secondary" data-testid="catalog-settings-image-value">{draft.imageUrl || "Nenhuma imagem escolhida"}</span>
          </div>
          <small className="font-normal">Capa interna da Véxora. Não é enviada à vitrine externa.</small>
          {safeCatalogImageUrl(draft.imageUrl) ? <div className="mt-1 max-w-xs"><div className={coverFrameTw}><img className={coverImageTw} src={safeCatalogImageUrl(draft.imageUrl)} alt="Prévia da imagem do item" /></div></div> : null}
        </div>
        <label className="flex items-start gap-2 text-small font-semibold text-ink-secondary">
          <input type="checkbox" className="mt-0.5 size-4 accent-blue-600" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
          <span>Item ativo<small className="block font-normal">Itens inativos ficam fora do catálogo usado no atendimento e na vitrine pública.</small></span>
        </label>
        <div data-testid="catalog-settings-public-fields" className={formTw}>
          <p className={noteTw}>Somente estes três campos são enviados para a vitrine externa. A descrição e a imagem internas continuam privadas na Véxora.</p>
          <label className={fieldTw}><span>Descrição pública da vitrine</span><textarea className={inputTw} data-testid="catalog-settings-public-description" maxLength={2000} rows={2} value={draft.publicDescription} placeholder="Texto aprovado para a vitrine" onChange={(event) => setDraft((current) => ({ ...current, publicDescription: event.target.value }))} /></label>
          <div className={formGridTw}>
            <label className={fieldTw}><span>Imagem pública da vitrine (HTTPS)</span><input className={inputTw} data-testid="catalog-settings-public-image" maxLength={1000} value={draft.publicImageUrl} placeholder="https://www.exemplo.com/imagem.png" onChange={(event) => setDraft((current) => ({ ...current, publicImageUrl: event.target.value }))} /></label>
            <label className={fieldTw}><span>Link público de solicitação de proposta (HTTPS)</span><input className={inputTw} data-testid="catalog-settings-public-link" maxLength={1000} value={draft.publicLink} placeholder="https://www.exemplo.com/contato/" onChange={(event) => setDraft((current) => ({ ...current, publicLink: event.target.value }))} /></label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButton} data-testid="catalog-settings-save" disabled={busy} onClick={() => void save()}>{editingId ? "Salvar alterações" : "Adicionar item"}</button>
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => setFormOpen(false)}>Fechar</button>
        </div>
      </section>
    </div> : null}
    <CatalogImagePicker open={imagePickerOpen} onClose={() => setImagePickerOpen(false)} onSelect={(value) => setDraft((current) => ({ ...current, imageUrl: value }))} />
  </section>;
}
