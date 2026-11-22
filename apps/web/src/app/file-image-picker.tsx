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

/* Utilities compartilhadas da fatia: slate real no escuro, azul só de realce. */
const primaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
const iconButton = "grid size-9 flex-none place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
const searchTw = "flex min-h-10 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
const searchInput = "min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none dark:text-slate-50";
const stateTw = "grid place-items-center gap-2.5 rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-600 dark:border-slate-600 dark:text-slate-300";
const itemTw = "relative grid grid-rows-2 overflow-hidden rounded-xl border-2 border-transparent bg-slate-100 p-0 text-left transition-colors hover:border-slate-300 dark:bg-slate-800 dark:hover:border-slate-600";
const itemSelectedTw = "relative grid grid-rows-2 overflow-hidden rounded-xl border-2 border-blue-500 bg-slate-100 p-0 text-left transition-colors hover:border-slate-300 dark:bg-slate-800 dark:hover:border-slate-600";

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
    <div className="fixed inset-0 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm" style={{ zIndex: 1000 }} role="presentation" data-testid="file-image-picker-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="relative flex max-h-dvh w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" style={{ zIndex: 1 }} role="dialog" aria-modal="true" aria-label={title} data-testid="file-image-picker">
        <header className="mb-3.5 flex flex-none items-center gap-3 pr-10">
          <span className="grid size-10 flex-none place-items-center rounded-lg border border-blue-200 bg-slate-100 text-blue-700 dark:border-blue-500/30 dark:bg-slate-800 dark:text-blue-300" data-testid="file-image-picker-icon"><ImageIcon size={20} aria-hidden="true" /></span>
          <div className="min-w-0"><h2 className="truncate">{title}</h2><p className="text-xs text-slate-600 dark:text-slate-300">Estas são as imagens do File manager do seu site. Envie do PC ou celular, ou escolha das que já estão no servidor.</p></div>
          <button type="button" className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-50" aria-label="Fechar" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="grid min-h-0 min-w-0 flex-1 gap-3 overflow-y-auto overscroll-contain" data-testid="file-image-picker-body">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className={searchTw}><Search size={16} aria-hidden="true" /><input autoFocus className={searchInput} value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar imagens…" aria-label="Pesquisar imagens" /></label>
            <button type="button" className={primaryButton} onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />} {uploading ? "Enviando…" : "Enviar imagem"}</button>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
          </div>
          {notice && <p className="m-0 text-xs text-blue-700 dark:text-blue-300" role="status">{notice}</p>}
          {assets === null ? <div className={stateTw} role="status"><Loader2 size={20} className="animate-spin" aria-hidden="true" /> Carregando imagens…</div>
            : !visible.length ? <div className={stateTw}><p>{assets.length ? "Nenhuma imagem corresponde à busca." : "Nenhuma imagem no File manager ainda — envie o primeiro arquivo."}</p></div>
            : <div className="grid max-h-96 grid-cols-2 gap-2.5 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4" data-testid="file-image-picker-grid">{visible.map(asset => { const isSelected = !!selected[asset.id]; return (
                <button key={asset.id} type="button" className={isSelected ? itemSelectedTw : itemTw} onClick={() => pick(asset)} aria-pressed={multiple ? isSelected : true} title={asset.name} data-testid="file-image-picker-item">
                  <img className="block aspect-4/3 w-full object-cover" src={asset.url} alt={asset.name || "Imagem"} loading="lazy" />
                  {multiple && isSelected && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-blue-600 text-white" data-testid="file-image-picker-check"><Check size={16} aria-hidden="true" /></span>}
                  <span className="truncate px-2.5 py-2 text-xs text-slate-700 dark:text-slate-200">{asset.name || "Imagem"}</span>
                </button>); })}</div>}
        </div>
        {multiple && <footer className="mt-0 flex flex-none flex-wrap justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700"><button type="button" className={secondaryButton} onClick={onClose}>Cancelar</button><button type="button" className={primaryButton} disabled={!Object.values(selected).some(Boolean)} onClick={confirm}>Inserir {Object.values(selected).filter(Boolean).length} imagem(ns)</button></footer>}
      </section>
    </div>
  );
}
