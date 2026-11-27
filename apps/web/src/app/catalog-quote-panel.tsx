"use client";
import { useEffect, useState } from "react";
import { Trash2, CirclePlus } from "lucide-react";

type Item = { id: string; kind: string; name: string; description: string; sku?: string | null; priceCents: number; currency: string; unit: string; imageUrl?: string | null; category?: string | null };
type ShareResponse = {
  status: string;
  configured: boolean;
  reason: string | null;
  notice: string;
  itemId: string | null;
  itemName: string | null;
  listUrl: string | null;
  itemUrl: string | null;
  text: string;
};

const primaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-linear-to-br from-blue-600 via-blue-500 to-blue-700 px-4 text-xs font-bold text-white shadow-lg transition-colors hover:from-blue-700 hover:via-blue-600 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-60 dark:from-slate-700 dark:via-blue-600 dark:to-blue-700 dark:hover:from-slate-600 dark:hover:via-blue-600 dark:hover:to-blue-700";
const shareButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 transition-colors hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:hover:border-blue-400";

/**
 * Assistente de orçamento para a inbox: seleciona itens do catálogo,
 * define quantidade e gera o PDF já enviado pela conversa.
 * Envia apenas os IDs e quantidades escolhidos; o servidor recalcula escopo e valor
 * a partir do catálogo do tenant e grava um snapshot no documento gerado.
 */
export function CatalogQuotePanel({ conversationId, contactName, onClose, onNotice, onInsert }: { conversationId: string; contactName: string; onClose: () => void; onNotice?: (msg: string) => void; onInsert?: (text: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareNotice, setShareNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/backend/catalog?q=${encodeURIComponent(search)}&limit=100`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) { setItems(Array.isArray(data?.items) ? data.items : []); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  const money = (cents: number, currency = "BRL") => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
  const selectedItems = Object.entries(saved).filter(([, qty]) => qty > 0).map(([id, qty]) => { const item = items.find(i => i.id === id); return item ? { item, qty } : null; }).filter(Boolean) as { item: Item; qty: number }[];
  const total = selectedItems.reduce((sum, row) => sum + row.item.priceCents * row.qty, 0);

  function insertSnapshot() {
    if (!selectedItems.length || !onInsert) return;
    const lines = selectedItems.map(({ item, qty }) => {
      const details = [item.sku, item.unit, item.description].filter((value) => typeof value === "string" && value.trim()).join(" · ");
      return `• ${qty}x ${item.name}${details ? ` (${details})` : ""} — ${money(item.priceCents * qty, item.currency)}`;
    });
    onInsert(`*Itens do catálogo*\n${lines.join("\n")}\n*Total:* ${money(total)}`);
    setError(""); setNotice("");
    onClose();
  }

  async function insertStorefrontLink(itemId?: string) {
    if (!onInsert) { setShareError("Inserção indisponível neste contexto."); return; }
    setShareBusy(true); setShareError(""); setShareNotice("");
    try {
      const query = itemId ? `?itemId=${encodeURIComponent(itemId)}` : "";
      const response = await fetch(`/api/backend/storefront/share${query}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Não foi possível consultar a vitrine pública.");
      const share = data as ShareResponse;
      if (typeof share.text !== "string" || !share.text.trim()) throw new Error("A vitrine não retornou um texto para inserir.");
      // O texto do servidor vai ao compositor exatamente como veio; nenhuma mensagem é enviada.
      onInsert(share.text);
      const statusNote = share.status === "UNCONFIGURED"
        ? "Vitrine sem URL HTTPS configurada: inserimos apenas o aviso do servidor, sem inventar link."
        : "Texto da vitrine inserido no compositor. Nenhuma mensagem foi enviada.";
      setShareNotice(`${statusNote} ${share.notice || ""}`.trim());
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Falha ao consultar a vitrine pública.");
    } finally { setShareBusy(false); }
  }

  async function sendQuote() {
    if (!selectedItems.length) { setError("Selecione ao menos um item do catálogo."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/backend/documents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "QUOTE", values: { nome_cliente: contactName }, catalogItems: selectedItems.map(({ item, qty }) => ({ id: item.id, quantity: qty })) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Não foi possível gerar o orçamento.");
      const sendResponse = await fetch(`/api/backend/documents/${data.document.id}/send-whatsapp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId }) });
      const sendData = await sendResponse.json().catch(() => ({}));
      if (!sendResponse.ok) throw new Error(typeof sendData?.message === "string" ? sendData.message : "Não foi possível enviar pelo WhatsApp.");
      setNotice(`Orçamento enviado para ${contactName}.`);
      onNotice?.(`Orçamento enviado para ${contactName}.`);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar o orçamento.");
    } finally { setBusy(false); }
  }

  return <div data-testid="catalog-quote-panel" className="grid min-h-80 content-start gap-2.5 px-3.5 py-3">
    {error ? <p data-testid="catalog-quote-error" className="mx-3.5 mt-1 text-xs leading-snug text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
    {notice ? <p data-testid="catalog-quote-notice" className="m-0 rounded-lg border border-emerald-300 bg-emerald-50 p-2 px-2.5 text-xs text-emerald-800 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-300" role="status">{notice}</p> : null}
    <label className="grid min-w-0"><input className="w-full min-h-9 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-2.5 py-2 font-normal text-slate-800 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto/serviço…" aria-label="Buscar produto ou serviço" /></label>
    <div data-testid="catalog-quote-list" className="grid content-start gap-1.5 overflow-auto max-h-96">
      {loading ? <p className="max-w-xs text-sm leading-normal text-slate-600 dark:text-slate-300">Carregando…</p> : items.length === 0 ? <p className="max-w-xs text-sm leading-normal text-slate-600 dark:text-slate-300">Nenhum item no catálogo. Cadastre no Catálogo ou peça para a administração cadastrar.</p> : items.map(item => {
        const qty = saved[item.id] ?? 0;
        return <div key={item.id} data-testid="catalog-quote-item" className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-2.5 py-2">
          <div className="grid min-w-0 gap-0.5">
            <strong className="truncate text-sm text-slate-800 dark:text-slate-50">{item.name}</strong>
            <small className="text-xs text-slate-600 dark:text-slate-300">{item.sku ? item.sku + " · " : ""}{item.unit} · {money(item.priceCents, item.currency)}</small>
          </div>
          <button type="button" data-testid="catalog-quote-qty-btn" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-2 text-xs font-bold text-slate-800 dark:text-slate-50 transition-colors hover:border-blue-500 hover:text-blue-700 dark:hover:border-blue-400 dark:hover:text-blue-200" aria-label={qty > 0 ? "Diminuir" : "Adicionar"} onClick={() => setSaved(s => ({ ...s, [item.id]: Math.max(0, qty + (qty > 0 ? -1 : 1)) }))}>
            {qty > 0 ? <Trash2 size={14} aria-hidden="true" /> : <CirclePlus size={14} aria-hidden="true" />}
            <span>{qty > 0 ? qty : "Adicionar"}</span>
          </button>
        </div>;
      })}
    </div>
    <section data-testid="catalog-quote-share" className="grid gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800">
      <p className="m-0 text-xs font-bold text-slate-700 dark:text-slate-200">Vitrine pública</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="catalog-quote-share-item" className={shareButton} disabled={shareBusy || selectedItems.length !== 1} onClick={() => void insertStorefrontLink(selectedItems[0]?.item.id)}>Inserir link do item</button>
        <button type="button" data-testid="catalog-quote-share-all" className={shareButton} disabled={shareBusy} onClick={() => void insertStorefrontLink()}>Inserir catálogo completo</button>
      </div>
      {shareError ? <p data-testid="catalog-quote-share-error" className="m-0 text-xs leading-snug text-red-700 dark:text-red-200" role="alert">{shareError}</p> : null}
      {shareNotice ? <p data-testid="catalog-quote-share-notice" className="m-0 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800 dark:border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-300" role="status">{shareNotice}</p> : null}
      <p className="m-0 text-xs text-slate-600 dark:text-slate-300">Os botões só inserem texto no compositor; o envio continua humano.</p>
    </section>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-2.5">
      <div className="flex items-center gap-2"><span>Total</span><strong className="text-sm">{money(total)}</strong></div>
      <div className="flex flex-wrap items-center gap-2">
        {onInsert ? <button type="button" data-testid="catalog-quote-insert" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-800 transition-colors hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:hover:border-blue-400" disabled={!selectedItems.length || busy} onClick={insertSnapshot}>Inserir na mensagem</button> : null}
        <button type="button" className={primaryButton} disabled={!selectedItems.length || busy} onClick={() => void sendQuote()}>{busy ? "Enviando…" : "Gerar e enviar orçamento"}</button>
      </div>
    </footer>
  </div>;
}
