"use client";
import { useEffect, useState } from "react";
import { Trash2, PackageSearch, Send, CirclePlus } from "lucide-react";

type Item = { id: string; kind: string; name: string; description: string; sku?: string | null; priceCents: number; currency: string; unit: string; imageUrl?: string | null; category?: string | null };

/**
 * Assistente de orçamento para a inbox: seleciona itens do catálogo,
 * define quantidade e gera o PDF já enviado pela conversa.
 * Usa as ferramentas MCP-padrão: create_document + share/send-whatsapp.
 */
export function CatalogQuotePanel({ conversationId, contactName, onClose, onNotice }: { conversationId: string; contactName: string; onClose: () => void; onNotice?: (msg: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  async function sendQuote() {
    if (!selectedItems.length) { setError("Selecione ao menos um item do catálogo."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const lines = selectedItems.map(({ item, qty }) => `${qty}x ${item.name} (${item.unit}) — ${money(item.priceCents * qty, item.currency)}`);
      const escopo = ["Itens:", ...lines.map(l => `• ${l}`)].join("\n");
      const response = await fetch("/api/backend/documents/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "QUOTE", values: { objetivo: "Orçamento de serviços", escopo, valor: money(total), prazo: "A combinar", forma_pagamento: "À vista ou em até 3x" } }) });
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

  return <div className="catalog-quote-panel">
    {error ? <p className="composer-ai-error" role="alert">{error}</p> : null}
    {notice ? <p className="catalog-quote-notice" role="status">{notice}</p> : null}
    <label className="catalog-quote-search"><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto/serviço…" aria-label="Buscar produto ou serviço" /></label>
    <div className="catalog-quote-list">
      {loading ? <p className="catalog-quote-empty">Carregando…</p> : items.length === 0 ? <p className="catalog-quote-empty">Nenhum item no catálogo. Cadastre em Configurações → Catálogo ou peça para a administração cadastrar.</p> : items.map(item => {
        const qty = saved[item.id] ?? 0;
        return <div key={item.id} className="catalog-quote-item">
          <div className="catalog-quote-item-info">
            <strong>{item.name}</strong>
            <small>{item.sku ? item.sku + " · " : ""}{item.unit} · {money(item.priceCents, item.currency)}</small>
          </div>
          <button type="button" className="catalog-quote-qty-btn" aria-label={qty > 0 ? "Diminuir" : "Adicionar"} onClick={() => setSaved(s => ({ ...s, [item.id]: Math.max(0, qty + (qty > 0 ? -1 : 1)) }))}>
            {qty > 0 ? <Trash2 size={14} aria-hidden="true" /> : <CirclePlus size={14} aria-hidden="true" />}
            <span>{qty > 0 ? qty : "Adicionar"}</span>
          </button>
        </div>;
      })}
    </div>
    <footer className="catalog-quote-footer">
      <div><span>Total</span><strong>{money(total)}</strong></div>
      <button type="button" className="primary-button" disabled={!selectedItems.length || busy} onClick={() => void sendQuote()}>{busy ? "Enviando…" : "Gerar e enviar orçamento"}</button>
    </footer>
  </div>;
}
