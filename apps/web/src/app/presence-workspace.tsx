"use client";

/**
 * Presença Véxora: referências de sites já no ar fora da plataforma e artes
 * produzidas/publicadas pelo orquestrador. Nenhum cartão afirma publicação sem
 * confirmação 2xx devolvida pelo backend.
 */

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";

const panelTw = "grid gap-3 rounded-token-sm border border-line bg-surface-2 p-pad";
const cardTw = "grid min-w-0 gap-3 rounded-token border border-line bg-surface p-pad text-ink shadow-token-sm";
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const fieldTw = "min-h-control w-full rounded-token-sm border border-line bg-surface-2 px-3 text-body text-ink outline-hidden focus:border-blue-600";
const labelTw = "grid gap-1 text-body font-bold text-ink";
const metaTw = "grid gap-1 text-2xs text-ink-secondary";
const pillTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-blue-50 px-2.5 text-2xs font-bold text-blue-800";

type ExternalSite = { id: string; title: string; url: string; description: string; addedAt: string };
type Artwork = { id: string; title: string; headline: string; subtitle: string; cta: string; status: "READY" | "PUBLISHED" | "FAILED"; url: string | null; verifiedAt: string | null; error: string | null; createdAt: string };
type Presence = { externalSites: ExternalSite[]; artworks: Artwork[]; cloudflareConfigured: boolean };

const STATUS: Record<Artwork["status"], string> = { READY: "Pronta para publicar", PUBLISHED: "Publicada e verificada", FAILED: "Publicação não confirmada" };

async function presenceFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/presence${path}`, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message ?? "Não foi possível concluir a operação de presença.");
  return payload as T;
}

function ArtCard({ art, canManage, onChanged, onNotice }: { art: Artwork; canManage: boolean; onChanged: () => void; onNotice: (message: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPreview = useCallback(async () => {
    if (preview) { setPreview(null); return; }
    setBusy(true);
    try {
      const data = await presenceFetch<{ svgBase64: string }>(`/art/${encodeURIComponent(art.id)}/svg`);
      setPreview(`data:image/svg+xml;base64,${data.svgBase64}`);
    } catch (cause) { onNotice(cause instanceof Error ? cause.message : "Não foi possível abrir a arte."); }
    finally { setBusy(false); }
  }, [art.id, preview, onNotice]);

  const publish = useCallback(async () => {
    setBusy(true);
    try {
      const result = await presenceFetch<{ url: string }>(`/art/${encodeURIComponent(art.id)}/publish`, { method: "POST" });
      onNotice(`Arte publicada e verificada: ${result.url}`);
      onChanged();
    } catch (cause) { onNotice(cause instanceof Error ? cause.message : "Não foi possível publicar a arte."); }
    finally { setBusy(false); }
  }, [art.id, onChanged, onNotice]);

  return (
    <article className={cardTw}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-body-lg font-bold">{art.title}</h3>
          <p className="text-body text-ink-secondary">{art.headline}</p>
        </div>
        <span className={pillTw}>{STATUS[art.status]}</span>
      </div>
      {art.url ? <a className="inline-flex items-center gap-1 text-body font-bold text-blue-700" href={art.url} target="_blank" rel="noreferrer">Abrir arte publicada <ExternalLink size={14} aria-hidden="true" /></a> : null}
      {art.error ? <p className="text-2xs text-red-600">{art.error}</p> : null}
      {preview ? <img src={preview} alt={`Prévia da arte ${art.title}`} className="w-full rounded-token-sm border border-line" /> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryTw} disabled={busy} onClick={() => void loadPreview()}>{busy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : null}{preview ? "Fechar prévia" : "Ver arte"}</button>
        {canManage && art.status !== "PUBLISHED" ? <button type="button" className={primaryTw} disabled={busy} onClick={() => void publish()}><Sparkles size={16} aria-hidden="true" /> Publicar via Cloudflare</button> : null}
      </div>
      <p className={metaTw}>Criada em {new Date(art.createdAt).toLocaleDateString("pt-BR")}{art.verifiedAt ? ` · verificada em ${new Date(art.verifiedAt).toLocaleDateString("pt-BR")}` : ""}</p>
    </article>
  );
}

const RASTREABEM_SITE = { title: "Rastreabem — site no ar", url: "https://rastreabem.com.br", description: "Site externo da empresa, fora da Véxora" };

export function PresenceWorkspace({ canManage, tenantSlug }: { canManage: boolean; tenantSlug?: string }) {
  const [data, setData] = useState<Presence>({ externalSites: [], artworks: [], cloudflareConfigured: false });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [site, setSite] = useState({ title: "", url: "https://", description: "" });
  const [art, setArt] = useState({ title: "", headline: "", subtitle: "", cta: "Saiba mais", background: "#101317", accent: "#FACC15", text: "#FFFFFF" });
  const [busy, setBusy] = useState<string | null>(null);
  const featuredSite = tenantSlug === "rastreabem" && !data.externalSites.some((item) => item.url.replace(/\/+$/, "").toLowerCase() === RASTREABEM_SITE.url) ? RASTREABEM_SITE : null;

  const reload = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    presenceFetch<Presence>("")
      .then(value => { if (live) setData(value); })
      .catch(cause => { if (live) setNotice(cause instanceof Error ? cause.message : "Não foi possível carregar a presença."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);

  const addSite = useCallback(async () => {
    setBusy("site");
    setNotice(null);
    try {
      await presenceFetch("/sites/external", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(site) });
      setSite({ title: "", url: "https://", description: "" });
      setNotice("Site externo registrado nesta empresa. A Véxora não afirma ter publicado ou hospedado este site.");
      reload();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Não foi possível registrar o site."); }
    finally { setBusy(null); }
  }, [site, reload]);

  const createArt = useCallback(async () => {
    setBusy("art");
    setNotice(null);
    try {
      await presenceFetch("/art", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...art, colors: { background: art.background, accent: art.accent, text: art.text } }) });
      setArt({ ...art, title: "", headline: "", subtitle: "" });
      setNotice("Arte criada pela Véxora. Abra a prévia e publique quando estiver aprovada.");
      reload();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Não foi possível criar a arte."); }
    finally { setBusy(null); }
  }, [art, reload]);

  const removeSite = useCallback(async (id: string) => {
    setBusy(id);
    try {
      await presenceFetch(`/sites/external/${encodeURIComponent(id)}`, { method: "DELETE" });
      setNotice("Referência removida desta empresa.");
      reload();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Não foi possível remover a referência."); }
    finally { setBusy(null); }
  }, [reload]);

  return (
    <section className="grid gap-token" aria-label="Presença Véxora">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-h5 font-extrabold text-ink">Presença Véxora — sites e artes</h2>
          <p className="mt-1 max-w-crm-copy text-body text-ink-secondary">
            Sites externos são referências do que já está no ar; artes são produzidas aqui e publicadas pelo orquestrador na Cloudflare. Só aparece como publicada depois de 2xx na URL final.
          </p>
        </div>
        <button type="button" className={secondaryTw} onClick={reload} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Atualizar</button>
      </header>
      {notice ? <p role="status" className={pillTw}>{notice}</p> : null}

      <section className={panelTw} aria-label="Sites externos">
        <h3 className="text-body-lg font-bold text-ink">Sites externos desta empresa</h3>
        {featuredSite ? (
          <a className={cardTw} href={featuredSite.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${featuredSite.title} em nova janela`}>
            <span className="flex flex-wrap items-center gap-2 text-body font-bold text-blue-700">{featuredSite.title} <ExternalLink size={14} aria-hidden="true" /></span>
            <span className="text-2xs text-ink-secondary">{featuredSite.description} · aberta em nova janela · sem registro de publicação pela Véxora</span>
          </a>
        ) : null}
        {data.externalSites.length ? (
          <ul className="grid gap-2">
            {data.externalSites.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-token-sm border border-line bg-surface px-3 py-2">
                <span className="min-w-0">
                  <a className="inline-flex items-center gap-1 text-body font-bold text-blue-700" href={item.url} target="_blank" rel="noreferrer">{item.title} <ExternalLink size={14} aria-hidden="true" /></a>
                  <span className="block text-2xs text-ink-secondary">{item.description || item.url} · registrado em {new Date(item.addedAt).toLocaleDateString("pt-BR")} · fora da Véxora</span>
                </span>
                {canManage ? <button type="button" className={secondaryTw} disabled={busy === item.id} onClick={() => void removeSite(item.id)} aria-label={`Remover referência ${item.title}`}><Trash2 size={14} aria-hidden="true" /> Remover</button> : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-body text-ink-secondary">Nenhum site externo cadastrado nesta empresa.</p>}
        {canManage ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className={labelTw}>Título<input className={fieldTw} value={site.title} onChange={event => setSite({ ...site, title: event.target.value })} placeholder="Rastreabem" /></label>
            <label className={labelTw}>URL<input className={fieldTw} value={site.url} onChange={event => setSite({ ...site, url: event.target.value })} placeholder="https://rastreabem.com.br" /></label>
            <label className={labelTw}>Descrição<input className={fieldTw} value={site.description} onChange={event => setSite({ ...site, description: event.target.value })} placeholder="Site observado no ar" /></label>
            <button type="button" className={primaryTw} disabled={busy === "site" || !site.title.trim()} onClick={() => void addSite()}>{busy === "site" ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : null} Cadastrar referência</button>
          </div>
        ) : null}
      </section>

      <section className={panelTw} aria-label="Estúdio de artes">
        <h3 className="text-body-lg font-bold text-ink">Estúdio de artes Véxora</h3>
        <p className="text-2xs text-ink-secondary">{data.cloudflareConfigured ? "Cloudflare configurada nesta instalação." : "Cloudflare não configurada nesta instalação: a arte pode ser criada, mas a publicação exigirá configuração."}</p>
        {canManage ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className={labelTw}>Título da arte<input className={fieldTw} value={art.title} onChange={event => setArt({ ...art, title: event.target.value })} placeholder="2ª via de boleto" /></label>
            <label className={labelTw}>Manchete<input className={fieldTw} value={art.headline} onChange={event => setArt({ ...art, headline: event.target.value })} placeholder="Resolva sua 2ª via" /></label>
            <label className={labelTw}>Subtítulo<input className={fieldTw} value={art.subtitle} onChange={event => setArt({ ...art, subtitle: event.target.value })} placeholder="Rastreabem — atendimento rápido" /></label>
            <label className={labelTw}>Chamada<input className={fieldTw} value={art.cta} onChange={event => setArt({ ...art, cta: event.target.value })} placeholder="Falar com a equipe" /></label>
            <label className={labelTw}>Fundo<input type="color" className={fieldTw} value={art.background} onChange={event => setArt({ ...art, background: event.target.value })} /></label>
            <label className={labelTw}>Destaque<input type="color" className={fieldTw} value={art.accent} onChange={event => setArt({ ...art, accent: event.target.value })} /></label>
            <button type="button" className={primaryTw} disabled={busy === "art" || !art.title.trim() || !art.headline.trim()} onClick={() => void createArt()}>{busy === "art" ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />} Criar arte</button>
          </div>
        ) : null}
        {data.artworks.length ? (
          <div className="grid grid-cols-1 gap-token lg:grid-cols-2">
            {data.artworks.map(item => <ArtCard key={item.id} art={item} canManage={canManage && data.cloudflareConfigured} onChanged={reload} onNotice={setNotice} />)}
          </div>
        ) : <p className="text-body text-ink-secondary">Nenhuma arte criada nesta empresa.</p>}
      </section>
    </section>
  );
}
