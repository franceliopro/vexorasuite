"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { api } from "./sites-shared";

type Asset = { id: string; name: string; kind: string; url: string; createdAt: string };
type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (urls: string[], assets: Asset[]) => void;
  multiple?: boolean;
  title?: string;
};

/* Utilities compartilhadas da fatia: azul vem dos tokens --primary do preset. */
const primaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-transparent bg-gradient-to-br from-blue-50 via-blue-600 to-blue-700 px-4 text-xs font-bold text-blue-900 shadow-vx-brand transition-colors hover:from-blue-100 hover:via-blue-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-3.5 text-xs font-bold text-ink shadow-token-sm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const iconButton = "grid size-control flex-none place-items-center rounded-token-sm border border-line bg-surface-2 text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const searchTw = "flex min-h-10 min-w-fm-search flex-1 items-center gap-2 rounded-fm-search border border-line bg-surface-2 px-3 text-ink-secondary";
const searchInput = "min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none";
const stateTw = "grid place-items-center gap-2.5 rounded-fm-card border border-dashed border-line-strong p-10 text-center text-ink-secondary";
const itemTw = "relative grid grid-rows-fm-picker-item overflow-hidden rounded-fm-card border-2 border-transparent bg-surface-2 p-0 text-left transition-colors hover:border-line";

/** Picas do File manager (as imagens que o próprio site guarda) — envie do PC/celular ou escolha das já enviadas. */
export function FileImagePicker({ open, onClose, onSelect, multiple, title = "File manager · escolher imagem" }: Props) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try { const data = await api<{ assets: Asset[] }>("/sites/assets", { cache: "no-store" }); setAssets((data?.assets || []).filter(a => a.kind === "image")); }
    catch { setNotice("Não foi possível carregar o File manager."); setAssets([]); }
  }, []);
  useEffect(() => { if (open) { setSelected({}); setQuery(""); setNotice(""); void load(); } }, [open, load]);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open, onClose]);

  const pick = (asset: Asset) => {
    if (!multiple) { onSelect([asset.url], [asset]); onClose(); return; }
    setSelected(v => ({ ...v, [asset.id]: !v[asset.id] }));
  };
  const confirm = () => { const ids = Object.keys(selected).filter(id => selected[id]); const chosen = (assets || []).filter(a => ids.includes(a.id)); if (chosen.length) onSelect(chosen.map(a => a.url), chosen); onClose(); };
  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files); if (!list.length) return;
    setUploading(true); setNotice("");
    try {
      for (const file of list) {
        const body = new FormData(); body.append("file", file);
        const r = await fetch("/api/backend/sites/assets", { method: "POST", body });
        if (!r.ok) { const json = await r.json().catch(() => null); setNotice(json?.message || "Falha ao enviar " + file.name); }
      }
    } finally { setUploading(false); await load(); }
  };
  const visible = (assets || []).filter(a => !query.trim() || (a.name || "").toLowerCase().includes(query.trim().toLowerCase()));
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-ib-dialog grid animate-vx-scrim-in place-items-center bg-overlay-soft p-vx-dialog-pad backdrop-blur-sm" role="presentation" data-testid="file-image-picker-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="relative z-ib-dialog-inner flex max-h-ib-dialog w-ib-dialog-wide animate-vx-in flex-col overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg" role="dialog" aria-modal="true" aria-label={title} data-testid="file-image-picker">
        <header className="mb-3.5 flex flex-none items-center gap-3 pr-10">
          <span className="grid size-ib-avatar-sm flex-none place-items-center rounded-ib-dialog-icon border border-blue-600/20 bg-blue-50 text-blue-800" data-testid="file-image-picker-icon"><ImageIcon size={20} aria-hidden="true" /></span>
          <div className="min-w-0"><h2 className="truncate">{title}</h2><p className="text-fm-caption text-ink-secondary">Estas são as imagens do File manager do seu site. Envie do PC ou celular, ou escolha das que já estão no servidor.</p></div>
          <button type="button" className="absolute right-3 top-3 z-10 grid size-ctl-sm place-items-center rounded-ib-dialog-icon border border-line bg-surface-2 text-ink-secondary transition-colors hover:bg-hover hover:text-ink" aria-label="Fechar" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="grid min-h-0 min-w-fm-picker-body flex-1 gap-3 overflow-y-auto overscroll-contain" data-testid="file-image-picker-body">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className={searchTw}><Search size={16} aria-hidden="true" /><input autoFocus className={searchInput} value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar imagens…" aria-label="Pesquisar imagens" /></label>
            <button type="button" className={primaryButton} onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />} {uploading ? "Enviando…" : "Enviar imagem"}</button>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
          </div>
          {notice && <p className="m-0 text-small text-blue-700" role="status">{notice}</p>}
          {assets === null ? <div className={stateTw} role="status"><Loader2 size={20} className="animate-spin" aria-hidden="true" /> Carregando imagens…</div>
            : !visible.length ? <div className={stateTw}><p>{assets.length ? "Nenhuma imagem corresponde à busca." : "Nenhuma imagem no File manager ainda — envie o primeiro arquivo."}</p></div>
            : <div className="grid grid-cols-fm-picker max-h-fm-picker-grid gap-2.5 overflow-auto pr-1" data-testid="file-image-picker-grid">{visible.map(asset => { const isSelected = !!selected[asset.id]; return (
                <button key={asset.id} type="button" className={itemTw + (isSelected ? " border-blue-600" : "")} onClick={() => pick(asset)} aria-pressed={multiple ? isSelected : true} title={asset.name} data-testid="file-image-picker-item">
                  <img className="block aspect-fm-preview w-full object-cover" src={asset.url} alt={asset.name || "Imagem"} loading="lazy" />
                  {multiple && isSelected && <span className="absolute right-2 top-2 grid size-fm-check place-items-center rounded-fm-pill bg-blue-600 text-blue-900" data-testid="file-image-picker-check"><Check size={16} aria-hidden="true" /></span>}
                  <span className="truncate px-2.5 py-2 text-fm-meta text-ink">{asset.name || "Imagem"}</span>
                </button>); })}</div>}
        </div>
        {multiple && <footer className="mt-0 flex flex-none flex-wrap justify-end gap-2 border-t border-line pt-3"><button type="button" className={secondaryButton} onClick={onClose}>Cancelar</button><button type="button" className={primaryButton} disabled={!Object.values(selected).some(Boolean)} onClick={confirm}>Inserir {Object.values(selected).filter(Boolean).length} imagem(ns)</button></footer>}
      </section>
    </div>
  );
}
