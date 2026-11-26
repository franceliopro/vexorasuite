"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Plus } from "lucide-react";
import { CatalogImagePicker, safeCatalogImageUrl } from "./catalog-image-picker";

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

/** ASAAS é a categoria que faz o item aparecer em Financeiro → Produtos e em Nova assinatura. */
const emptyDraft = (): Draft => ({ kind: "SERVICE", name: "", description: "", sku: "", price: "", currency: "BRL", unit: "un", imageUrl: "", category: "ASAAS" });

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
const noteTw = "m-0 text-small text-ink-secondary";

export function CatalogSettings({ canManage, initialItemId = "", backLabel = "Voltar aos Produtos", onBack }: { canManage: boolean; initialItemId?: string; backLabel?: string; onBack: () => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const appliedEditId = useRef("");

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
      category: item.category || "ASAAS",
    });
    setError("");
    setNotice("");
  }, [initialItemId, items]);

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
        imageUrl: safeCatalogImageUrl(draft.imageUrl),
        category: draft.category.trim() || "ASAAS",
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

  return <section data-testid="catalog-settings" className={cardTw} aria-labelledby="catalog-settings-title">
    <div className={headingTw}>
      <div>
        <h2 id="catalog-settings-title" className={headingTitleTw}>{editingId ? "Editar produto/serviço" : "Novo produto/serviço"}</h2>
        <p className={headingCopyTw}>{editingId ? "Altere os dados e salve para atualizar a vitrine do Financeiro." : "Cadastre um produto ou serviço para usar em Financeiro, atendimento e documentos."}</p>
      </div>
      {canManage ? <button type="button" className={secondaryButton} data-testid="catalog-settings-new" disabled={busy} onClick={resetDraft}><Plus size={15} aria-hidden="true" /> Novo produto</button> : null}
    </div>
    {error ? <div className={feedbackErrorTw} role="alert">{error}</div> : null}
    {notice ? <div className={feedbackSuccessTw} role="status">{notice}</div> : null}
    {!canManage ? <div className={feedbackErrorTw} role="note">Somente OWNER e ADMIN podem alterar o catálogo.</div> : null}
    {loading && initialItemId ? <p className={noteTw}>Carregando item do catálogo…</p> : null}
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
        <label className={fieldTw}><span>Categoria</span><input className={inputTw} maxLength={80} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /><small className="font-normal">Use <strong>ASAAS</strong> para este item aparecer em Financeiro → Produtos e em Nova assinatura.</small></label>
      </div>
      <div className={fieldTw}>
        <span>Imagem do produto</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={secondaryButton} data-testid="catalog-settings-image-picker" onClick={() => setImagePickerOpen(true)}><ImageIcon size={15} aria-hidden="true" /> Escolher imagem</button>
          <span className="min-w-0 break-all text-small text-ink-secondary" data-testid="catalog-settings-image-value">{draft.imageUrl || "Nenhuma imagem escolhida"}</span>
        </div>
        {safeCatalogImageUrl(draft.imageUrl) ? <img className="mt-1 w-full max-w-xs rounded-token-sm border border-gray-200 object-cover" src={safeCatalogImageUrl(draft.imageUrl)} alt="Prévia da imagem do produto" /> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButton} data-testid="catalog-settings-save" disabled={busy} onClick={() => void save()}>{editingId ? "Salvar alterações" : "Adicionar item"}</button>
        <button type="button" className={secondaryButton} disabled={busy} onClick={onBack}>{backLabel}</button>
      </div>
    </div> : null}
    <CatalogImagePicker open={imagePickerOpen} onClose={() => setImagePickerOpen(false)} onSelect={(value) => setDraft((current) => ({ ...current, imageUrl: value }))} />
  </section>;
}
