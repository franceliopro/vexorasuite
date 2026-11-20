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
        if (source.kind === "ia" && source.prompt) body.prompt = source.prompt;
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
        const warnings: string[] = Array.isArray(payload?.warnings) ? payload.warnings : [];
        setAttempt((value) => value + 1);
        setEditingSite(summary);
        const prefix = imported ? `Site "${summary.name}" importado.` : `Site "${summary.name}" criado como rascunho.`;
        const detail = source.kind === "ia"
          ? " Rascunho premium com textos sugeridos pela sua descrição — revise no editor."
          : warnings.length
            ? ` Avisos: ${warnings.slice(0, 2).join(" ")}`
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
    <section className="simple-workspace">
      <header className="page-heading">
        <div>
          <h1>Sites</h1>
          <p className="page-subtitle">Crie a presença digital da sua empresa: site institucional, landing page, blog, imobiliária ou loja.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="secondary-button" onClick={() => setAttempt((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> Atualizar
          </button>
          {canManage ? (
            <button type="button" className="primary-button" onClick={() => setWizardOpen(true)} disabled={creating}>
              {creating ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              Novo site
            </button>
          ) : null}
        </div>
      </header>

      {notice ? <p role="status" className="status-pill">{notice}</p> : null}
      {actionError ? (
        <p role="alert" style={{ color: "var(--danger, #b42318)", margin: "0 0 16px" }}>
          <AlertCircle size={15} aria-hidden="true" /> {actionError}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="content-card">
          <p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {loading ? (
        <p role="status">
          <Loader2 className="spin" size={16} aria-hidden="true" /> Carregando sites…
        </p>
      ) : null}

      {!loading && !error && sites.length === 0 ? (
        <div className="content-card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <Globe size={30} aria-hidden="true" />
          <h2>Nenhum site ainda</h2>
          <p>Comece pelo assistente: escolha criar do zero, clonar um link ou importar um ZIP.</p>
          {canManage ? (
            <button type="button" className="primary-button" onClick={() => setWizardOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Criar meu primeiro site
            </button>
          ) : (
            <p>Peça a um administrador da empresa para criar o primeiro site.</p>
          )}
        </div>
      ) : null}

      {!loading && sites.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginTop: 8 }}>
          {sites.map((site) => (
            <article key={site.id} className="content-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={18} aria-hidden="true" />
                <strong style={{ fontSize: 16 }}>{site.name}</strong>
              </div>
              <small style={{ opacity: 0.8 }}>{KIND_LABEL[site.kind] || site.kind}</small>
              <small style={{ opacity: 0.7 }}>Endereço interno: /{site.slug}</small>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <span className="status-pill">{DOMAIN_LABEL[site.domainStatus] || site.domainStatus}</span>
                <span className="status-pill muted">{site.published ? "Publicado" : "Rascunho"}</span>
              </div>
              {site.domain ? <small style={{ opacity: 0.8 }}>Domínio: {site.domain}</small> : null}
              <small style={{ opacity: 0.6 }}>Atualizado em {dateBR(site.updatedAt)}</small>
              <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.75 }}>
                Editor visual, domínio próprio e publicação via Cloudflare no editor.
              </p>
              <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {canManage ? (
                  <button type="button" className="primary-button" onClick={() => setEditingSite(site)}>
                    <Pencil size={15} aria-hidden="true" /> Abrir editor
                  </button>
                ) : null}
                {canManage ? (
                  confirmingId === site.id ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void removeSite(site)}
                        disabled={removingId === site.id}
                      >
                        {removingId === site.id ? <Loader2 className="spin" size={15} aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
                        Confirmar exclusão
                      </button>
                      <button type="button" className="secondary-button" onClick={() => setConfirmingId(null)} disabled={removingId === site.id}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button type="button" className="secondary-button" onClick={() => setConfirmingId(site.id)}>
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
          onClose={() => setEditingSite(null)}
        />
      ) : null}
    </section>
  );
}
