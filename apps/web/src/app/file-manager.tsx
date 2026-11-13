"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, FileText, Image as ImageIcon, Loader2, Search, Trash2, Upload } from "lucide-react";
import { api } from "./sites-shared";

type Asset = { id: string; name: string; kind: string; mimeType: string; width: number; height: number; url: string; createdAt: string };
type Filter = "all" | "image" | "file";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** File manager: envia, lista, pesquisa e exclui arquivos no servidor (imagens e PDFs). */
export function FileManager({ onNotice }: { onNotice?: (v: string) => void }) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [uploading, setUploading] = useState(0);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const flash = (v: string) => { setNotice(v); onNotice?.(v); window.setTimeout(() => setNotice(""), 3500); };
  const load = useCallback(async () => {
    try { const data = await api<{ assets: Asset[] }>("/sites/assets", { cache: "no-store" }); setAssets(Array.isArray(data?.assets) ? data.assets : []); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível listar os arquivos."); setAssets([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(list.length);
    let done = 0; let failed = 0;
    const results = await Promise.allSettled(list.map(async (file) => {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/backend/sites/assets", { method: "POST", body });
      if (!response.ok) { const json = await response.json().catch(() => null); throw new Error(json?.message || "Falha no upload de " + file.name); }
      return response.json();
    }));
    for (const r of results) { if (r.status === "fulfilled") done++; else failed++; }
    setUploading(0);
    flash(failed ? `${done} enviado(s) · ${failed} falhou(aram).` : `${done} arquivo(s) enviado(s).`);
    await load();
  };
  const remove = async (asset: Asset) => {
    if (!window.confirm(`Excluir "${asset.name || asset.id}" do servidor? O arquivo sumirá de todos os lugares onde foi usado.`)) return;
    setBusyId(asset.id);
    try { await api(`/sites/assets/${asset.id}`, { method: "DELETE" }); flash("Arquivo excluído do servidor."); await load(); }
    catch (e) { flash(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setBusyId(""); }
  };
  const copy = async (asset: Asset) => {
    const absolute = new URL(asset.url, window.location.origin).toString();
    try { await navigator.clipboard.writeText(absolute); flash("URL copiada para a área de transferência."); }
    catch { flash("Não foi possível copiar: " + absolute); }
  };
  const visible = (assets || []).filter(a => (filter === "all" || a.kind === filter) && (!query.trim() || (a.name || "").toLowerCase().includes(query.trim().toLowerCase())));
  return (
    <div className="file-manager">
      <header className="file-manager-toolbar">
        <div className="file-manager-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar arquivos pelo nome…" aria-label="Pesquisar arquivos" /></div>
        <div className="file-manager-filters" role="group" aria-label="Filtrar por tipo">{([["all", "Todos"], ["image", "Imagens"], ["file", "Arquivos"]] as [Filter, string][]).map(([value, label]) => <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <button type="button" className="primary-button" onClick={() => inputRef.current?.click()} disabled={uploading > 0}>{uploading > 0 ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />} {uploading > 0 ? `Enviando…` : "Enviar arquivos"}</button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple hidden onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      </header>
      {notice && <p className="file-manager-notice" role="status">{notice}</p>}
      {assets === null ? <div className="file-manager-loading"><Loader2 size={22} className="vx-spin" aria-hidden="true" /> Carregando arquivos…</div>
        : !visible.length ? <div className="file-manager-empty"><ImageIcon size={30} aria-hidden="true" /><p>{assets.length ? "Nenhum arquivo corresponde à busca." : "Nenhum arquivo ainda. Envie o primeiro — depois, use “Imagem” no editor para inserir nos posts."}</p></div>
        : <div className="file-manager-grid">{visible.map(asset => (
            <article key={asset.id} className="file-manager-item">
              <div className="file-manager-preview">{asset.kind === "image"
                ? <img src={asset.url} alt={asset.name || "Arquivo"} loading="lazy" />
                : <span className="file-manager-pdf"><FileText size={34} aria-hidden="true" /><small>PDF</small></span>}</div>
              <div className="file-manager-item-body">
                <strong title={asset.name}>{asset.name || "Arquivo"}</strong>
                <small>{fmtDate(asset.createdAt)}{asset.kind === "image" ? ` · ${asset.width}×${asset.height}` : ""}</small>
              </div>
              <div className="file-manager-item-actions">
                <button type="button" className="icon-button" title="Copiar URL" aria-label="Copiar URL" onClick={() => void copy(asset)}><Copy size={15} aria-hidden="true" /></button>
                <button type="button" className="icon-button" title="Excluir do servidor" aria-label="Excluir" disabled={busyId === asset.id} onClick={() => void remove(asset)}>{busyId === asset.id ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}</button>
              </div>
            </article>
          ))}</div>}
      {assets !== null && <p className="file-manager-hint">{assets.length} arquivo(s) no servidor · excluir aqui remove do site e de todos os posts onde foi usado.</p>}
    </div>
  );
}
