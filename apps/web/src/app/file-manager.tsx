"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Copy, File as FileIcon, Folder, FolderPlus, Image as ImageIcon, Loader2, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { api } from "./sites-shared";

type Asset = { id: string; name: string; kind: string; folder: string; mimeType: string; width: number; height: number; url: string; createdAt: string };
type FolderRow = { path: string; name: string };
type Filter = "all" | "image" | "file";
type Listing = { folder: string; parent: string; folders: FolderRow[]; assets: Asset[] };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtSize = (a: Asset) => a.kind === "image" ? `${a.width}×${a.height}` : "PDF";

/** Gerenciador de arquivos dos sites: criar/navegar/renomear/mover/excluir pastas e arquivos, com preview visual. */
export function FileManager({ onNotice, onSelect, selectable }: { onNotice?: (v: string) => void; onSelect?: (url: string, name: string) => void; selectable?: boolean }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [allFolders, setAllFolders] = useState<FolderRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [uploading, setUploading] = useState(0);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [renameId, setRenameId] = useState<string>("");
  const [renameValue, setRenameValue] = useState("");
  const [folderRename, setFolderRename] = useState<string>("");
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [preview, setPreview] = useState<Asset | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folder = listing?.folder ?? "/";
  const flash = (v: string) => { setNotice(v); onNotice?.(v); window.setTimeout(() => setNotice(""), 3500); };

  const load = useCallback(async (target: string) => {
    try { const data = await api<Listing>("/sites/assets?folder=" + encodeURIComponent(target), { cache: "no-store" }); setListing(data); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível listar os arquivos."); setListing({ folder: target, parent: "/", folders: [], assets: [] }); }
  }, []);
  const loadAllFolders = useCallback(async () => {
    try { const data = await api<{ folders: FolderRow[] }>("/sites/assets/all-folders", { cache: "no-store" }); setAllFolders(Array.isArray(data?.folders) ? data.folders : []); } catch { setAllFolders([]); }
  }, []);
  useEffect(() => { void load(folder); }, [folder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadAllFolders(); }, [loadAllFolders]);

  const navigate = (target: string) => { setListing(null); setPreview(null); void load(target); };
  const crumbs = useMemo(() => {
    const parts = folder.split("/").filter(Boolean);
    const out: { label: string; path: string }[] = [{ label: "Raiz", path: "/" }];
    let current = "";
    for (const part of parts) { current += "/" + part; out.push({ label: part, path: current }); }
    return out;
  }, [folder]);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(list.length);
    let done = 0; let failed = 0;
    const results = await Promise.allSettled(list.map(async (file) => {
      const body = new FormData(); body.append("file", file); body.append("folder", folder);
      const response = await fetch("/api/backend/sites/assets", { method: "POST", body });
      if (!response.ok) { const json = await response.json().catch(() => null); throw new Error(json?.message || "Falha no upload de " + file.name); }
      return response.json();
    }));
    for (const r of results) { if (r.status === "fulfilled") done++; else failed++; }
    setUploading(0);
    flash(failed ? `${done} enviado(s) · ${failed} falhou(aram).` : `${done} arquivo(s) enviado(s).`);
    await load(folder); await loadAllFolders();
  };
  const remove = async (asset: Asset) => {
    if (!window.confirm(`Excluir "${asset.name || asset.id}" do servidor? O arquivo sumirá de todos os lugares onde foi usado.`)) return;
    setBusyId(asset.id);
    try { await api(`/sites/assets/${asset.id}`, { method: "DELETE" }); flash("Arquivo excluído do servidor."); await load(folder); await loadAllFolders(); }
    catch (e) { flash(e instanceof Error ? e.message : "Não foi possível excluir."); }
    finally { setBusyId(""); }
  };
  const rename = async (asset: Asset) => {
    const name = renameValue.trim();
    if (!name) return;
    setBusyId(asset.id);
    try { await api(`/sites/assets/${asset.id}`, { method: "PATCH", body: JSON.stringify({ name }) }); setRenameId(""); flash("Arquivo renomeado."); await load(folder); }
    catch (e) { flash(e instanceof Error ? e.message : "Não foi possível renomear."); }
    finally { setBusyId(""); }
  };
  const moveAsset = async (asset: Asset, target: string) => {
    setBusyId(asset.id);
    try { await api(`/sites/assets/${asset.id}/move`, { method: "POST", body: JSON.stringify({ folder: target }) }); flash("Arquivo movido."); await load(folder); await loadAllFolders(); }
    catch (e) { flash(e instanceof Error ? e.message : "Não foi possível mover."); }
    finally { setBusyId(""); }
  };
  const createFolder = async () => {
    const name = newFolderName.trim().replace(/[\\/]/g, "-");
    if (!name) return;
    const path = folder === "/" ? "/" + name : folder + "/" + name;
    setBusyId("__new_folder__");
    try { await api("/sites/assets/folders", { method: "POST", body: JSON.stringify({ path }) }); setNewFolderOpen(false); setNewFolderName(""); flash("Pasta criada."); navigate(path); await loadAllFolders(); }
    catch (e) { flash(e instanceof Error ? e.message : "Não foi possível criar a pasta."); }
    finally { setBusyId(""); }
  };
  const renameFolder = async (path: string) => {
    const name = folderRenameValue.trim().replace(/[\\/]/g, "-");
    if (!name) return;
    const parent = path.substring(0, path.lastIndexOf("/"));
    const newPath = (parent === "" ? "" : parent) + "/" + name;
    setBusyId(path);
    try { await api("/sites/assets/folders/rename", { method: "PATCH", body: JSON.stringify({ path, newPath }) }); setFolderRename(""); flash("Pasta renomeada."); await load(folder); await loadAllFolders(); }
    catch (e) { flash(e instanceof Error ? e.message : "Não foi possível renomear a pasta."); }
    finally { setBusyId(""); }
  };
  const deleteFolder = async (path: string, name: string) => {
    if (!window.confirm(`Excluir a pasta "${name}" e todo o conteúdo dela? Esta ação não pode ser desfeita.`)) return;
    setBusyId(path);
    try { const res = await api<{ deleted: boolean; assetsDeleted: number }>("/sites/assets/folders", { method: "DELETE", body: JSON.stringify({ path }) }); flash(`Pasta excluída (${res.assetsDeleted ?? 0} arquivo(s) removido(s)).`); await load(folder); await loadAllFolders(); }
    catch (e) { flash(e instanceof Error ? e.message : "Não foi possível excluir a pasta."); }
    finally { setBusyId(""); }
  };
  const copy = async (asset: Asset) => {
    const absolute = new URL(asset.url, window.location.origin).toString();
    try { await navigator.clipboard.writeText(absolute); flash("URL copiada para a área de transferência."); }
    catch { flash("Não foi possível copiar: " + absolute); }
  };

  const assets = listing?.assets ?? [];
  const folders = listing?.folders ?? [];
  const visibleAssets = assets.filter(a => (filter === "all" || a.kind === filter) && (!query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase())));
  const visibleFolders = folders.filter(f => !query.trim() || f.name.toLowerCase().includes(query.trim().toLowerCase()));
  const empty = !visibleFolders.length && !visibleAssets.length;

  return (
    <div className="file-manager">
      <header className="file-manager-toolbar">
        <nav className="file-manager-breadcrumb" aria-label="Navegação de pastas">{crumbs.map((crumb, index) => <span key={crumb.path}>{index > 0 ? <ChevronRight size={14} aria-hidden="true" className="file-manager-crumb-sep" /> : null}<button type="button" className="file-manager-crumb" onClick={() => navigate(crumb.path)}>{crumb.label}</button></span>)}</nav>
        <div className="file-manager-search"><Search size={16} aria-hidden="true" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar nesta pasta…" aria-label="Pesquisar nesta pasta" /></div>
        <div className="file-manager-filters" role="group" aria-label="Filtrar por tipo">{([["all", "Todos"], ["image", "Imagens"], ["file", "Arquivos"]] as [Filter, string][]).map(([value, label]) => <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <button type="button" className="secondary-button" onClick={() => { setNewFolderOpen(v => !v); setNewFolderName(""); }}><FolderPlus size={15} aria-hidden="true" /> Nova pasta</button>
        <button type="button" className="primary-button" onClick={() => inputRef.current?.click()} disabled={uploading > 0 || !listing}>{uploading > 0 ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />} {uploading > 0 ? "Enviando…" : "Enviar arquivos"}</button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple hidden onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
      </header>
      {notice && <p className="file-manager-notice" role="status">{notice}</p>}
      {newFolderOpen && <div className="file-manager-new-folder"><Folder size={16} aria-hidden="true" /><input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nome da pasta" aria-label="Nome da nova pasta" onKeyDown={e => { if (e.key === "Enter") void createFolder(); if (e.key === "Escape") setNewFolderOpen(false); }} /><button type="button" className="primary-button" disabled={busyId === "__new_folder__" || !newFolderName.trim()} onClick={() => void createFolder()}>{busyId === "__new_folder__" ? <Loader2 size={14} className="vx-spin" aria-hidden="true" /> : "Criar"}</button><button type="button" className="icon-button" aria-label="Cancelar" onClick={() => setNewFolderOpen(false)}><X size={15} aria-hidden="true" /></button></div>}
      {listing === null ? <div className="file-manager-loading"><Loader2 size={22} className="vx-spin" aria-hidden="true" /> Carregando arquivos…</div>
        : empty ? <div className="file-manager-empty"><ImageIcon size={30} aria-hidden="true" /><p>{assets.length || folders.length ? "Nenhum item corresponde à busca." : "Pasta vazia. Envie arquivos ou crie uma pasta."}</p></div>
        : <div className="file-manager-grid">
            {visibleFolders.map(f => (
              <article key={"folder:" + f.path} className="file-manager-item file-manager-folder">
                <button type="button" className="file-manager-folder-open" onClick={() => navigate(f.path)} aria-label={"Abrir pasta " + f.name}>
                  <Folder size={46} aria-hidden="true" />
                </button>
                <div className="file-manager-item-body">
                  {folderRename === f.path ? <input autoFocus value={folderRenameValue} onChange={e => setFolderRenameValue(e.target.value)} onBlur={() => void renameFolder(f.path)} onKeyDown={e => { if (e.key === "Enter") void renameFolder(f.path); if (e.key === "Escape") setFolderRename(""); }} aria-label="Renomear pasta" /> : <strong title={f.name}>{f.name}</strong>}
                </div>
                <div className="file-manager-item-actions">
                  <button type="button" className="icon-button" title="Renomear pasta" aria-label="Renomear pasta" onClick={() => { setFolderRename(f.path); setFolderRenameValue(f.name); }}><Pencil size={15} aria-hidden="true" /></button>
                  <button type="button" className="icon-button" title="Excluir pasta e conteúdo" aria-label="Excluir pasta" disabled={busyId === f.path} onClick={() => void deleteFolder(f.path, f.name)}>{busyId === f.path ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}</button>
                </div>
              </article>
            ))}
            {visibleAssets.map(asset => (
              <article key={asset.id} className="file-manager-item">
                <button type="button" className="file-manager-preview" onClick={() => { if (selectable && asset.kind === "image" && onSelect) { onSelect(asset.url, asset.name); return; } asset.kind === "image" ? setPreview(asset) : copy(asset); }} aria-label={selectable && asset.kind === "image" ? "Selecionar imagem " + asset.name : (asset.kind === "image" ? "Ampliar imagem " + asset.name : "Copiar URL de " + asset.name)}>{asset.kind === "image" ? <img src={asset.url} alt={asset.name || "Arquivo"} loading="lazy" /> : <span className="file-manager-pdf"><FileIcon size={34} aria-hidden="true" /><small>PDF</small></span>}</button>
                <div className="file-manager-item-body">
                  {renameId === asset.id ? <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={() => void rename(asset)} onKeyDown={e => { if (e.key === "Enter") void rename(asset); if (e.key === "Escape") setRenameId(""); }} aria-label="Renomear arquivo" /> : <strong title={asset.name}>{asset.name || "Arquivo"}</strong>}
                  <small>{fmtDate(asset.createdAt)} · {fmtSize(asset)}</small>
                </div>
                <div className="file-manager-item-actions">
                  <button type="button" className="icon-button" title="Copiar URL" aria-label="Copiar URL" onClick={() => void copy(asset)}><Copy size={15} aria-hidden="true" /></button>
                  <button type="button" className="icon-button" title="Renomear arquivo" aria-label="Renomear arquivo" onClick={() => { setRenameId(asset.id); setRenameValue(asset.name.replace(/\.[a-z0-9]{2,6}$/i, "")); }}><Pencil size={15} aria-hidden="true" /></button>
                  <select className="file-manager-move" aria-label="Mover para pasta" defaultValue="" disabled={busyId === asset.id} onChange={e => { const target = e.target.value; if (target) void moveAsset(asset, target); e.target.value = ""; }}><option value="">Mover para…</option>{allFolders.filter(f => f.path !== asset.folder).map(f => <option key={f.path} value={f.path}>{f.path === "/" ? "(Raiz)" : f.path}</option>)}</select>
                  <button type="button" className="icon-button" title="Excluir do servidor" aria-label="Excluir" disabled={busyId === asset.id} onClick={() => void remove(asset)}>{busyId === asset.id ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}</button>
                </div>
              </article>
            ))}
          </div>}
      {preview && <div className="file-manager-lightbox" role="dialog" aria-modal="true" aria-label={"Visualizar " + preview.name} onClick={() => setPreview(null)}><figure onClick={e => e.stopPropagation()}><img src={preview.url} alt={preview.name || "Arquivo"} /><figcaption><span>{preview.name}</span><a className="secondary-button" href={preview.url} download={preview.name}>Baixar</a><button type="button" className="icon-button" aria-label="Fechar" onClick={() => setPreview(null)}><X size={18} aria-hidden="true" /></button></figcaption></figure></div>}
    </div>
  );
}
