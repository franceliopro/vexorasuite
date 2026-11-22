"use client";

/**
 * Sites — porta de entrada do criador.
 *
 * Lista os sites da empresa e cria novos pelo wizard em tela cheia. O wizard pode criar
 * do zero ou importar URL, HTML e ZIP (Elementor/Divi/Beaver/Crocoblock). Cada cartão mostra
 * o estado real do site (rascunho, domínio, publicações) sem prometer o que não aconteceu.
 */

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Globe, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import WizardShell, { type WizardSource } from "./sites/wizard/wizard-shell";

const SiteEditorWindow = dynamic(() => import("./sites/site-editor-window"), {
  ssr: false,
  loading: () => <p role="status">Carregando editor…</p>,
});

const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const workspaceTw = "grid gap-token";
const headingTw = "flex flex-wrap items-start justify-between gap-4";
const subtitleTw = "mt-1 max-w-crm-copy text-body leading-relaxed text-ink-secondary";
const statusPillTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-blue-50 px-2.5 text-2xs font-bold text-blue-800";
const statusMutedTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-2xs font-bold text-ink-secondary";
const cardTw = "grid min-w-0 gap-2 rounded-token border border-line bg-surface p-pad text-ink shadow-token-sm";
const emptyTw = "grid place-items-center gap-2 rounded-token border border-line bg-surface px-6 py-10 text-center text-ink shadow-token-sm";
const siteGridTw = "grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-3";
const siteCardTw = "flex min-w-0 flex-col gap-2 rounded-token border border-line bg-surface p-pad text-ink shadow-token-sm";
const siteHeadTw = "flex items-center gap-2";
const sitePillsTw = "mt-1 flex flex-wrap gap-2";
const siteActionsTw = "mt-auto flex flex-wrap gap-2 pt-2";

type SiteSummary = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  domain: string | null;
  domainStatus: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { pages: number; siteDeployments: number };
};

const KIND_LABEL: Record<string, string> = {
  STATIC: "Site institucional",
  LANDING: "Landing page",
  BLOG: "Blog / portal",
  REAL_ESTATE: "Imobiliária",
  ECOMMERCE: "Loja / e-commerce",
};

const DOMAIN_LABEL: Record<string, string> = {
  NONE: "Sem domínio próprio",
  PENDING_DNS: "Aguardando DNS",
  VERIFYING: "Verificando domínio",
  ACTIVE: "Domínio ativo",
  LIVE: "Publicado",
};

function wizardKind(value: string): string {
  switch (value) {
    case "landing":
      return "LANDING";
    case "blog":
      return "BLOG";
    case "real-estate":
      return "REAL_ESTATE";
    case "ecommerce":
      return "ECOMMERCE";
    default:
      return "STATIC";
  }
}

function dateBR(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

export function SitesWorkspace({ canManage }: { canManage: boolean }) {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<SiteSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetch("/api/backend/sites", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Sessão expirada. Entre novamente." : "Não foi possível carregar seus sites.");
        return response.json() as Promise<SiteSummary[]>;
      })
      .then((value) => {
        if (live) setSites(Array.isArray(value) ? value : []);
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : "Não foi possível carregar seus sites.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const createSite = useCallback(
    async (input: { title: string; type: string; source: WizardSource; logoUrl?: string }) => {
      setWizardOpen(false);
      setCreating(true);
      setActionError(null);
      setNotice(null);
      try {
        const kind = wizardKind(input.type);
        let endpoint = "/api/backend/sites";
        let body: Record<string, unknown> = { name: input.title, kind };
        const source = input.source;
        if (source.kind === "ia" || source.kind === "image") {
          if (source.prompt) body.prompt = source.prompt;
          if (source.layoutImage) body.layoutImage = source.layoutImage;
        }
        if (input.logoUrl) body.logoUrl = input.logoUrl;
        if (source.kind === "clone") {
          endpoint = "/api/backend/sites/import/url";
          body = { name: input.title, kind, url: source.url };
        } else if (source.kind === "html") {
          endpoint = "/api/backend/sites/import/html";
          body = { name: input.title, kind, html: source.html };
        } else if (source.kind === "zip") {
          endpoint = "/api/backend/sites/import/zip";
          body = { name: input.title, kind, fileName: source.fileName, contentBase64: source.contentBase64 };
        }
        const imported = source.kind === "clone" || source.kind === "html" || source.kind === "zip";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message || (imported ? "Não foi possível importar o site." : "Não foi possível criar o site."));
        }
        const site = imported ? payload?.site : payload;
        if (!site?.id) throw new Error("O servidor não retornou o site criado.");
        const summary: SiteSummary = {
          id: String(site.id),
          name: String(site.name ?? input.title),
          slug: String(site.slug ?? ""),
          kind: String(site.kind ?? kind),
          domain: site.domain ?? null,
          domainStatus: String(site.domainStatus ?? "NONE"),
          published: Boolean(site.published),
          createdAt: String(site.createdAt ?? new Date().toISOString()),
          updatedAt: String(site.updatedAt ?? new Date().toISOString()),
        };
        const warnings: string[] = Array.isArray(payload?.warnings)
          ? payload.warnings
          : Array.isArray(site.warnings)
            ? site.warnings
            : [];
        setAttempt((value) => value + 1);
        setEditingSite(summary);
        const prefix = imported ? `Site "${summary.name}" importado.` : `Site "${summary.name}" criado como rascunho.`;
        const detail = warnings.length
          ? ` Avisos: ${warnings.slice(0, 2).join(" ")}`
          : source.kind === "image"
            ? " Rascunho recriado a partir da imagem de layout — revise no editor."
            : source.kind === "ia"
              ? source.layoutImage
                ? " Rascunho com estrutura sugerida pela imagem de layout — revise no editor."
                : " Rascunho premium com textos sugeridos pela sua descrição — revise no editor."
              : "";
        setNotice(prefix + detail);
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : "Não foi possível criar o site.");
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const removeSite = useCallback(async (site: SiteSummary) => {
    setRemovingId(site.id);
    setActionError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/backend/sites/${site.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Não foi possível excluir o site.");
      }
      setSites((current) => current.filter((item) => item.id !== site.id));
      setNotice(`Site "${site.name}" excluído.`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Não foi possível excluir o site.");
    } finally {
      setRemovingId(null);
      setConfirmingId(null);
    }
  }, []);

  return (
    <section className={workspaceTw}>
      <header className={headingTw}>
        <div>
          <h1>Sites</h1>
          <p className={subtitleTw}>Crie a presença digital da sua empresa: site institucional, landing page, blog, imobiliária ou loja.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={secondaryTw} onClick={() => setAttempt((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> Atualizar
          </button>
          {canManage ? (
            <button type="button" className={primaryTw} onClick={() => setWizardOpen(true)} disabled={creating}>
              {creating ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              Novo site
            </button>
          ) : null}
        </div>
      </header>

      {notice ? <p role="status" className={statusPillTw}>{notice}</p> : null}
      {actionError ? (
        <p role="alert" style={{ color: "var(--danger, #b42318)", margin: "0 0 16px" }}>
          <AlertCircle size={15} aria-hidden="true" /> {actionError}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className={cardTw}>
          <p>{error}</p>
          <button type="button" className={secondaryTw} onClick={() => setAttempt((value) => value + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {loading ? (
        <p role="status">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" /> Carregando sites…
        </p>
      ) : null}

      {!loading && !error && sites.length === 0 ? (
        <div className={emptyTw}>
          <Globe size={30} aria-hidden="true" />
          <h2>Nenhum site ainda</h2>
          <p>Comece pelo assistente: escolha criar do zero, clonar um link ou importar um ZIP.</p>
          {canManage ? (
            <button type="button" className={primaryTw} onClick={() => setWizardOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Criar meu primeiro site
            </button>
          ) : (
            <p>Peça a um administrador da empresa para criar o primeiro site.</p>
          )}
        </div>
      ) : null}

      {!loading && sites.length > 0 ? (
        <div className={siteGridTw}>
          {sites.map((site) => (
            <article key={site.id} className={siteCardTw}>
              <div className={siteHeadTw}>
                <Globe size={18} aria-hidden="true" />
                <strong style={{ fontSize: 16 }}>{site.name}</strong>
              </div>
              <small style={{ opacity: 0.8 }}>{KIND_LABEL[site.kind] || site.kind}</small>
              <small style={{ opacity: 0.7 }}>Endereço interno: /{site.slug}</small>
              <div className={sitePillsTw}>
                <span className={statusPillTw}>{DOMAIN_LABEL[site.domainStatus] || site.domainStatus}</span>
                <span className={statusMutedTw}>{site.published ? "Publicado" : "Rascunho"}</span>
              </div>
              {site.domain ? <small style={{ opacity: 0.8 }}>Domínio: {site.domain}</small> : null}
              <small style={{ opacity: 0.6 }}>Atualizado em {dateBR(site.updatedAt)}</small>
              <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.75 }}>
                Editor visual, domínio próprio e publicação via Cloudflare no editor.
              </p>
              <div className={siteActionsTw}>
                {canManage ? (
                  <button type="button" className={primaryTw} onClick={() => setEditingSite(site)}>
                    <Pencil size={15} aria-hidden="true" /> Abrir editor
                  </button>
                ) : null}
                {canManage ? (
                  confirmingId === site.id ? (
                    <>
                      <button
                        type="button"
                        className={secondaryTw}
                        onClick={() => void removeSite(site)}
                        disabled={removingId === site.id}
                      >
                        {removingId === site.id ? <Loader2 className="animate-spin" size={15} aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                        Confirmar exclusão
                      </button>
                      <button type="button" className={secondaryTw} onClick={() => setConfirmingId(null)} disabled={removingId === site.id}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button type="button" className={secondaryTw} onClick={() => setConfirmingId(site.id)}>
                      <Trash2 size={15} aria-hidden="true" /> Excluir
                    </button>
                  )
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <WizardShell
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(site) => void createSite({ title: site.title, type: site.type, logoUrl: site.logoUrl, source: site.source })}
        disabled={creating}
      />

      {editingSite ? (
        <SiteEditorWindow
          siteId={editingSite.id}
          title={editingSite.name}
          domain={editingSite.domain}
          domainStatus={editingSite.domainStatus}
          canEdit={canManage}
          onClose={() => setEditingSite(null)}
        />
      ) : null}
    </section>
  );
}
