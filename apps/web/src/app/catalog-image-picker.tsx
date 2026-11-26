"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Folder, Image as ImageIcon, Link2, Loader2, Search, Upload, X } from "lucide-react";
import { api } from "./sites-shared";

type Asset = { id: string; name: string; kind: string; url: string };
type DriveAccount = { id: string; email: string; canManage?: boolean; limited?: boolean };
type DriveFile = { id: string; name: string; mimeType: string; capabilities?: { canDownload?: boolean } };
type Tab = "pc" | "drive" | "url";

const FOLDER = "application/vnd.google-apps.folder";
const backdropTw = "fixed inset-0 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm";
const dialogTw = "relative flex max-h-dvh w-full max-w-4xl flex-col overflow-hidden rounded-token border border-line bg-surface p-pad text-ink shadow-token-lg";
const headerTw = "mb-3 flex flex-none items-start justify-between gap-3 pr-8";
const tabTw = "inline-flex min-h-9 items-center gap-2 rounded-token-sm border border-line bg-surface-2 px-3.5 text-small font-bold text-ink transition-colors hover:bg-hover";
const tabActiveTw = "inline-flex min-h-9 items-center gap-2 rounded-token-sm border border-transparent bg-blue-600 px-3.5 text-small font-bold text-blue-50 transition-colors";
const bodyTw = "grid min-h-0 min-w-0 flex-1 gap-3 overflow-y-auto overscroll-contain";
const toolbarTw = "flex flex-wrap items-center gap-2.5";
const searchTw = "flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-token-sm border border-line bg-surface-2 px-2.5 text-ink-secondary";
const searchInputTw = "min-w-0 flex-1 border-0 bg-transparent text-small text-ink outline-hidden";
const buttonTw = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-3.5 text-small font-bold text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const primaryTw = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-small font-bold text-blue-50 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const stateTw = "grid place-items-center gap-2 rounded-token border border-dashed border-line-strong bg-surface-2 p-6 text-center text-small text-ink-secondary";
const gridTw = "grid min-h-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4";
const itemTw = "flex flex-col overflow-hidden rounded-token-sm border border-line bg-surface text-left text-ink transition-colors hover:border-line-strong";
const itemSelectedTw = "flex flex-col overflow-hidden rounded-token-sm border border-blue-600 bg-blue-50 text-left text-ink";
const previewTw = "grid min-h-0 grid-cols-1 gap-2 rounded-token border border-line bg-surface-2 p-2.5 sm:grid-cols-2";
const previewFrameTw = "grid aspect-square place-items-center overflow-hidden rounded-token-sm border border-line bg-surface-3";
const footerTw = "mt-0 flex flex-none flex-wrap justify-end gap-2 border-t border-line pt-3";
const fieldLabelTw = "grid gap-1 text-small font-bold text-ink-secondary";
const selectTw = "min-h-9 rounded-token-sm border border-line bg-surface-2 px-2.5 text-small text-ink";

/** Imagens privadas: só HTTPS ou caminhos internos da própria API. */
export function safeCatalogImageUrl(value: string): string {
  const url = value.trim();
  return /^https?:\/\//i.test(url) || url.startsWith("/api/") ? url : "";
}

export function CatalogImagePicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (url: string) => void }) {
  const [tab, setTab] = useState<Tab>("pc");
  const [url, setUrl] = useState("");
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [accounts, setAccounts] = useState<DriveAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [trail, setTrail] = useState([{ id: "root", name: "Meu Drive" }]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [driveQuery, setDriveQuery] = useState("");
  const [driveSearch, setDriveSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const parent = trail[trail.length - 1]!.id;

  const loadAssets = useCallback(async () => {
    try {
      const data = await api<{ assets: Asset[] }>("/sites/assets", { cache: "no-store" });
      setAssets((Array.isArray(data.assets) ? data.assets : []).filter((asset) => asset.kind === "image"));
    } catch {
      setAssets([]);
      setNotice("Não foi possível consultar as imagens enviadas. Você ainda pode usar um link HTTPS.");
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const rows = await api<DriveAccount[]>("/drive-manager/accounts");
      const list = Array.isArray(rows) ? rows : [];
      setAccounts(list);
      setAccountId((current) => current || list[0]?.id || "");
    } catch {
      setAccounts([]);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    if (!accountId) {
      setFiles([]);
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ parent, view: "folder" });
      if (driveQuery.trim()) params.set("q", driveQuery.trim());
      const data = await api<{ files?: DriveFile[] }>(`/drive-manager/${encodeURIComponent(accountId)}/files?${params.toString()}`);
      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch (e) {
      setFiles([]);
      setNotice(e instanceof Error ? e.message : "Não foi possível consultar o Google Drive.");
    } finally {
      setBusy(false);
    }
  }, [accountId, parent, driveQuery]);

  useEffect(() => {
    if (!open) return;
    setTab("pc");
    setUrl("");
    setNotice("");
    setTrail([{ id: "root", name: "Meu Drive" }]);
    setDriveQuery("");
    void loadAssets();
    void loadAccounts();
  }, [open, loadAssets, loadAccounts]);

  useEffect(() => {
    if (open && tab === "drive") void loadFiles();
  }, [open, tab, loadFiles]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setNotice("");
    try {
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/backend/sites/assets", { method: "POST", body });
        if (!response.ok) {
          const json = await response.json().catch(() => null);
          setNotice(json?.message || `Falha ao enviar ${file.name}.`);
        }
      }
      await loadAssets();
    } finally {
      setUploading(false);
    }
  };

  const choose = (value: string) => {
    setUrl(value);
    setNotice("Imagem selecionada. Confirme abaixo para usar no produto.");
  };

  const preview = safeCatalogImageUrl(url);
  const visibleAssets = (assets || []).filter((asset) => !assetQuery.trim() || (asset.name || "").toLowerCase().includes(assetQuery.trim().toLowerCase()));
  const visibleFiles = files.filter((file) => file.mimeType === FOLDER || (file.mimeType.startsWith("image/") && file.capabilities?.canDownload !== false));

  if (!open) return null;
  return (
    <div className={backdropTw} role="presentation" data-testid="catalog-image-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={dialogTw} role="dialog" aria-modal="true" aria-labelledby="catalog-image-picker-title" data-testid="catalog-image-picker">
        <header className={headerTw}>
          <div className="min-w-0">
            <h2 id="catalog-image-picker-title" className="m-0 text-asaas-title font-extrabold text-ink">Escolher imagem do produto</h2>
            <p className="m-0 text-small text-ink-secondary">Envie do seu computador, escolha no Google Drive conectado ou informe um link HTTPS.</p>
          </div>
          <button type="button" className="absolute right-3 top-3 grid size-8 place-items-center rounded-token-sm border border-line bg-surface-2 text-ink transition-colors hover:bg-hover" aria-label="Fechar" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </header>

        <div className="mb-3 flex flex-none flex-wrap gap-2" role="tablist" aria-label="Origem da imagem">
          <button type="button" role="tab" aria-selected={tab === "pc"} className={tab === "pc" ? tabActiveTw : tabTw} onClick={() => setTab("pc")}><Upload size={15} aria-hidden="true" /> Computador</button>
          <button type="button" role="tab" aria-selected={tab === "drive"} className={tab === "drive" ? tabActiveTw : tabTw} onClick={() => setTab("drive")}><Folder size={15} aria-hidden="true" /> Google Drive</button>
          <button type="button" role="tab" aria-selected={tab === "url"} className={tab === "url" ? tabActiveTw : tabTw} onClick={() => setTab("url")}><Link2 size={15} aria-hidden="true" /> Link HTTPS</button>
        </div>

        <div className={bodyTw} data-testid="catalog-image-picker-body">
          {notice ? <p className="m-0 text-small text-blue-700" role="status">{notice}</p> : null}

          {tab === "pc" ? <>
            <div className={toolbarTw}>
              <button type="button" className={primaryTw} disabled={uploading} onClick={() => inputRef.current?.click()}><Upload size={15} aria-hidden="true" /> {uploading ? "Enviando…" : "Enviar do computador"}</button>
              <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files?.length) void upload(event.target.files); event.target.value = ""; }} />
              <label className={searchTw}><Search size={16} aria-hidden="true" /><input className={searchInputTw} value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Buscar imagem enviada" aria-label="Buscar imagem enviada" /></label>
            </div>
            {assets === null ? <div className={stateTw} role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando imagens…</div>
              : !visibleAssets.length ? <div className={stateTw}>Nenhuma imagem salva. Envie uma do computador para começar.</div>
                : <div className={gridTw} data-testid="catalog-image-picker-assets">{visibleAssets.map((asset) => <button key={asset.id} type="button" className={url === asset.url ? itemSelectedTw : itemTw} onClick={() => choose(asset.url)} data-testid="catalog-image-picker-asset"><span className="grid aspect-square place-items-center overflow-hidden bg-surface-3"><img className="size-full object-cover" src={asset.url} alt={asset.name || "Imagem"} loading="lazy" /></span><span className="truncate px-2 py-1.5 text-2xs text-ink-secondary">{asset.name || "Imagem"}{url === asset.url ? <Check size={13} className="ml-1 inline" aria-hidden="true" /> : null}</span></button>)}</div>}
          </> : null}

          {tab === "drive" ? <>
            {!accounts.length ? <div className={stateTw}>Nenhuma conta do Google Drive conectada para esta empresa. Conecte o Drive em Configurações → Conexões para escolher arquivos daí.</div> : <>
              <div className={toolbarTw}>
                <label className={fieldLabelTw}>Conta<select className={selectTw} value={accountId} onChange={(event) => { setAccountId(event.target.value); setTrail([{ id: "root", name: "Meu Drive" }]); setDriveQuery(""); setUrl(""); }}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email}</option>)}</select></label>
                <form className={toolbarTw} onSubmit={(event) => { event.preventDefault(); setDriveQuery(driveSearch); }}>
                  <label className={searchTw}><Search size={16} aria-hidden="true" /><input className={searchInputTw} value={driveSearch} onChange={(event) => setDriveSearch(event.target.value)} placeholder="Buscar no Drive" aria-label="Buscar no Drive" /></label>
                  <button type="submit" className={buttonTw}>Buscar</button>
                </form>
              </div>
              <nav className="flex flex-wrap items-center gap-1.5" aria-label="Localização no Google Drive">{trail.map((part, index) => <button key={part.id} type="button" className={buttonTw} onClick={() => { setTrail((current) => current.slice(0, index + 1)); setDriveQuery(""); setUrl(""); }}>{part.name}{index < trail.length - 1 ? <ChevronRight size={13} aria-hidden="true" /> : null}</button>)}</nav>
              {busy ? <p className="m-0 text-small text-ink-secondary" role="status">Consultando o Drive…</p> : null}
              {!visibleFiles.length ? <div className={stateTw}>Nenhuma imagem nesta pasta. Abra uma pasta ou limpe a busca.</div>
                : <div className={gridTw} data-testid="catalog-image-picker-drive">{visibleFiles.map((file) => <button key={file.id} type="button" className={itemTw} onClick={() => { if (file.mimeType === FOLDER) { setTrail((current) => [...current, { id: file.id, name: file.name }]); setDriveQuery(""); setUrl(""); } else { choose(`/api/backend/drive-manager/${encodeURIComponent(accountId)}/files/${encodeURIComponent(file.id)}/content`); } }} data-testid="catalog-image-picker-drive-file"><span className="grid aspect-square place-items-center overflow-hidden bg-surface-3">{file.mimeType === FOLDER ? <Folder size={26} aria-hidden="true" /> : <img className="size-full object-cover" src={`/api/backend/drive-manager/${encodeURIComponent(accountId)}/files/${encodeURIComponent(file.id)}/thumbnail`} alt={file.name} loading="lazy" />}</span><span className="truncate px-2 py-1.5 text-2xs text-ink-secondary">{file.name}</span></button>)}</div>}
            </>}
          </> : null}

          {tab === "url" ? <label className="grid gap-1.5 text-small font-bold text-ink-secondary"><span>Endereço da imagem</span><input className="min-h-10 w-full rounded-token-sm border border-line bg-surface-2 px-3 text-small text-ink focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://exemplo.com/imagem.png" data-testid="catalog-image-picker-url" /><small className="font-normal">Aceitamos links HTTPS e imagens salvas na própria Véxora.</small></label> : null}

          <div className={previewTw}>
            <div className={previewFrameTw}>{preview ? <img className="size-full object-cover" src={preview} alt="Prévia da imagem" /> : <ImageIcon size={28} aria-hidden="true" />}</div>
            <div className="grid min-w-0 content-start gap-1.5">
              <strong className="text-small text-ink">Prévia</strong>
              <span className="min-w-0 break-all text-2xs text-ink-secondary">{preview || "Escolha uma imagem para ver a prévia."}</span>
              <small className="text-2xs text-ink-secondary">A imagem fica gravada no catálogo da empresa. Nada é enviado para canais externos.</small>
            </div>
          </div>
        </div>

        <footer className={footerTw}>
          <button type="button" className={buttonTw} onClick={onClose}>Cancelar</button>
          <button type="button" className={primaryTw} data-testid="catalog-image-picker-confirm" disabled={!preview} onClick={() => { onSelect(preview); onClose(); }}><Check size={15} aria-hidden="true" /> Usar imagem</button>
        </footer>
      </section>
    </div>
  );
}
