"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";

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
  category: string;
};

const emptyDraft = (): Draft => ({ kind: "SERVICE", name: "", description: "", sku: "", price: "", currency: "BRL", unit: "un", imageUrl: "", category: "" });

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Falha ao carregar o catálogo.");
  return data as T;
}

const cardTw = "grid gap-4 self-start rounded-token border border-gray-200 bg-zinc-200 p-pad";
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
const textButton = "inline-flex min-h-8 items-center justify-center gap-1.5 px-1.5 font-bold text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60";
const listTw = "grid gap-2";
const itemTw = "grid grid-cols-1 gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-3 sm:grid-cols-2";
const itemTitleTw = "flex min-w-0 items-center gap-2 text-body font-bold text-ink";
const itemMetaTw = "text-small text-ink-secondary";
const badgeTw = "inline-flex min-h-6 items-center rounded-cf-tag px-cf-tag-x text-2xs font-bold";
const mutedTw = "text-asaas-muted text-ink-secondary";

export function CatalogSettings({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | Kind>("ALL");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      if (kindFilter !== "ALL" && item.kind !== kindFilter) return false;
      return !needle || `${item.name} ${item.description || ""} ${item.sku || ""} ${item.category || ""}`.toLocaleLowerCase("pt-BR").includes(needle);
    });
  }, [items, query, kindFilter]);

  const money = (item: CatalogItem) => (item.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: item.currency || "BRL" });

  function startEdit(item: CatalogItem) {
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
      category: item.category || "",
    });
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
        imageUrl: draft.imageUrl.trim(),
        category: draft.category.trim(),
      };
      if (editingId) await api(`/api/backend/catalog/${encodeURIComponent(editingId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      else await api("/api/backend/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setNotice(editingId ? "Item atualizado. Novos documentos usarão os dados atuais." : "Item adicionado ao catálogo da empresa.");
      resetDraft();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar o item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: CatalogItem) {
    if (!canManage) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const url = `/api/backend/catalog/${encodeURIComponent(item.id)}`;
      if (item.active) await api(url, { method: "DELETE" });
      else await api(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: true }) });
      setNotice(item.active ? "Item desativado. Documentos antigos mantêm o snapshot." : "Item reativado no catálogo.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar o item.");
    } finally {
      setBusy(false);
    }
  }

  return <section data-testid="catalog-settings" className={cardTw} aria-labelledby="catalog-settings-title">
    <div className={headingTw}>
      <div>
        <h2 id="catalog-settings-title" className={headingTitleTw}>Catálogo de produtos e serviços</h2>
        <p className={headingCopyTw}>Fonte única da empresa para atendimento, orçamentos, documentos, chatbot e IAs. Preço e descrição vêm sempre do catálogo.</p>
      </div>
    </div>
    {error ? <div className={feedbackErrorTw} role="alert">{error}</div> : null}
    {notice ? <div className={feedbackSuccessTw} role="status">{notice}</div> : null}
    {!canManage ? <div className={feedbackErrorTw} role="note">Somente OWNER e ADMIN podem alterar o catálogo. Você está vendo os itens ativos desta empresa.</div> : null}
    {canManage ? <div data-testid="catalog-settings-form" className={formTw}>
      <div className={toolbarTw}>
        <label className={fieldTw}><span>Tipo</span><select className={inputTw} value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Kind }))}><option value="SERVICE">Serviço</option><option value="PRODUCT">Produto digital</option></select></label>
        <label className={fieldTw}><span>Nome</span><input className={inputTw} data-testid="catalog-settings-name" maxLength={160} value={draft.name} placeholder="ex.: Site institucional" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
      </div>
      <label className={fieldTw}><span>Descrição</span><textarea className={inputTw} maxLength={2000} rows={2} value={draft.description} placeholder="O que está incluído" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
      <div className={formGridTw}>
        <label className={fieldTw}><span>Preço</span><input className={inputTw} data-testid="catalog-settings-price" inputMode="decimal" maxLength={20} value={draft.price} placeholder="0,00" onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} /></label>
        <label className={fieldTw}><span>Moeda</span><input className={inputTw} maxLength={3} value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))} /></label>
        <label className={fieldTw}><span>Unidade</span><input className={inputTw} maxLength={10} value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} /></label>
        <label className={fieldTw}><span>SKU</span><input className={inputTw} maxLength={80} value={draft.sku} onChange={(event) => setDraft((current) => ({ ...current, sku: event.target.value }))} /></label>
        <label className={fieldTw}><span>Categoria</span><input className={inputTw} maxLength={80} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></label>
        <label className={fieldTw}><span>URL da imagem</span><input className={inputTw} maxLength={1000} value={draft.imageUrl} onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButton} data-testid="catalog-settings-save" disabled={busy} onClick={() => void save()}>{editingId ? "Salvar alterações" : "Adicionar item"}</button>
        {editingId ? <button type="button" className={secondaryButton} disabled={busy} onClick={resetDraft}>Cancelar edição</button> : null}
      </div>
    </div> : null}
    <div className={toolbarTw}>
      <label className={fieldTw}><span>Buscar item</span><span className="relative"><Search size={16} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-secondary" /><input className={inputTw} data-testid="catalog-settings-search" value={query} placeholder="Nome, descrição, SKU ou categoria" onChange={(event) => setQuery(event.target.value)} /></span></label>
      <label className={fieldTw}><span>Filtrar por tipo</span><select className={inputTw} value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "ALL" | Kind)}><option value="ALL">Todos</option><option value="SERVICE">Serviços</option><option value="PRODUCT">Produtos digitais</option></select></label>
    </div>
    <div data-testid="catalog-settings-list" className={listTw}>
      {loading ? <p className={mutedTw}>Carregando catálogo…</p> : null}
      {!loading && filtered.length === 0 ? <p className={mutedTw}>Nenhum item encontrado. {canManage ? "Cadastre um item no formulário acima." : "Peça à administração para cadastrar itens."}</p> : null}
      {filtered.map((item) => <div className={itemTw} key={item.id} data-testid="catalog-item">
        <div className={itemTitleTw}><Package size={16} aria-hidden="true" /><span>{item.name}</span><span className={badgeTw} data-kind={item.kind}>{item.kind === "PRODUCT" ? "Produto digital" : "Serviço"}</span>{!item.active ? <span className={badgeTw}>Inativo</span> : null}</div>
        <div className={itemMetaTw}>{item.sku ? `${item.sku} · ` : ""}{item.category ? `${item.category} · ` : ""}{item.unit} · <strong data-testid="catalog-item-price">{money(item)}</strong>{item.description ? <><br />{item.description}</> : null}</div>
        {canManage ? <div className="flex flex-wrap gap-2"><button type="button" className={textButton} data-testid="catalog-settings-edit" onClick={() => startEdit(item)}><Pencil size={14} aria-hidden="true" /> Editar</button><button type="button" className={textButton} data-testid={item.active ? "catalog-settings-deactivate" : "catalog-settings-reactivate"} disabled={busy} onClick={() => void toggleActive(item)}>{item.active ? <><Trash2 size={14} aria-hidden="true" /> Desativar</> : <><RotateCcw size={14} aria-hidden="true" /> Reativar</>}</button></div> : null}
      </div>)}
    </div>
  </section>;
}
