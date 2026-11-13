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
    <div className="vx-dialog-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="vx-dialog vx-dialog-wide file-image-picker" role="dialog" aria-modal="true" aria-label={title}>
        <header className="vx-dialog-heading"><span className="vx-dialog-icon"><ImageIcon size={20} aria-hidden="true" /></span><div><h2>{title}</h2><p>Estas são as imagens do File manager do seu site. Envie do PC ou celular, ou escolha das que já estão no servidor.</p></div><button type="button" className="vx-dialog-close" aria-label="Fechar" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
        <div className="vx-dialog-body">
          <div className="file-image-picker-toolbar">
            <label className="file-manager-search"><Search size={16} aria-hidden="true" /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar imagens…" aria-label="Pesquisar imagens" /></label>
            <button type="button" className="primary-button" onClick={() => inputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />} {uploading ? "Enviando…" : "Enviar imagem"}</button>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
          </div>
          {notice && <p className="file-manager-notice" role="status">{notice}</p>}
          {assets === null ? <div className="file-manager-loading"><Loader2 size={20} className="vx-spin" aria-hidden="true" /> Carregando imagens…</div>
            : !visible.length ? <div className="file-manager-empty"><p>{assets.length ? "Nenhuma imagem corresponde à busca." : "Nenhuma imagem no File manager ainda — envie o primeiro arquivo."}</p></div>
            : <div className="file-image-picker-grid">{visible.map(asset => { const isSelected = !!selected[asset.id]; return (
                <button key={asset.id} type="button" className={"file-image-picker-item" + (isSelected ? " is-selected" : "")} onClick={() => pick(asset)} aria-pressed={multiple ? isSelected : true} title={asset.name}>
                  <img src={asset.url} alt={asset.name || "Imagem"} loading="lazy" />
                  {multiple && isSelected && <span className="file-image-picker-check"><Check size={16} aria-hidden="true" /></span>}
                  <span className="file-image-picker-name">{asset.name || "Imagem"}</span>
                </button>); })}</div>}
        </div>
        {multiple && <footer className="vx-dialog-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="button" className="primary-button" disabled={!Object.values(selected).some(Boolean)} onClick={confirm}>Inserir {Object.values(selected).filter(Boolean).length} imagem(ns)</button></footer>}
      </section>
    </div>
  );
}
