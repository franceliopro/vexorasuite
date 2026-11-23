"use client";

/**
 * Sites — HUB de pedidos, não criador visual.
 *
 * A Véxora governa pedido, preview, aprovação, versão, histórico e auditoria.
 * Não gera HTML, não hospeda página e não publica por conta própria: a confirmação
 * só acontece depois que o próprio domínio responde 2xx ao health-check da API.
 */

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, ExternalLink, Loader2, RefreshCw } from "lucide-react";

const workspaceTw = "grid gap-token";
const headingTw = "flex flex-wrap items-start justify-between gap-4";
const subtitleTw = "mt-1 max-w-crm-copy text-body leading-relaxed text-ink-secondary";
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const cardTw = "grid min-w-0 gap-3 rounded-token border border-line bg-surface p-pad text-ink shadow-token-sm";
const panelTw = "grid gap-3 rounded-token-sm border border-line bg-surface-2 p-pad";
const emptyTw = "grid place-items-center gap-2 rounded-token border border-line bg-surface px-6 py-10 text-center text-ink shadow-token-sm";
const pillTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-blue-50 px-2.5 text-2xs font-bold text-blue-800";
const mutedTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-2xs font-bold text-ink-secondary";
const fieldTw = "min-h-control w-full rounded-token-sm border border-line bg-surface-2 px-3 text-body text-ink outline-hidden focus:border-blue-600";
const labelTw = "grid gap-1 text-body font-bold text-ink";
const formGridTw = "grid grid-cols-1 gap-token md:grid-cols-2";
const metaTw = "grid gap-1 text-2xs text-ink-secondary";

type HubStatus = "DRAFT" | "PREVIEW_READY" | "APPROVED" | "REJECTED" | "PUBLISH_REQUESTED" | "PUBLISHED";
type HubVersion = { id: string; version: number; previewUrl: string; commitSha: string | null; notes: string | null; createdAt: string };
type HubApproval = { id: string; decision: "APPROVED" | "REJECTED"; note: string | null; decidedBy: string; createdAt: string };
type HubEvent = { id: string; action: string; createdAt: string; details: Record<string, unknown> | null };
type HubRequest = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  status: HubStatus;
  brief: Record<string, unknown>;
  repository: string | null;
  targetDomain: string | null;
  previewUrl: string | null;
  previewSha: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: HubVersion[];
  approvals?: HubApproval[];
  events?: HubEvent[];
};

const STATUS_LABEL: Record<HubStatus, string> = {
  DRAFT: "Pedido em rascunho",
  PREVIEW_READY: "Preview registrado",
  APPROVED: "Aprovado pelo cliente",
  REJECTED: "Rejeitado",
  PUBLISH_REQUESTED: "Publicação solicitada",
  PUBLISHED: "Publicação confirmada",
};

const KIND_LABEL: Record<string, string> = {
  STATIC: "Site institucional",
  LANDING: "Landing page",
  BLOG: "Blog / portal",
  REAL_ESTATE: "Imobiliária",
  ECOMMERCE: "Loja / e-commerce",
  PORTAL: "Portal",
};

const KINDS = ["STATIC", "LANDING", "BLOG", "REAL_ESTATE", "ECOMMERCE", "PORTAL"];

function dateBR(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

async function hubFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/sites/hub/requests${path}`, {
    cache: "no-store",
    ...init,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? "Não foi possível concluir a operação no HUB de Sites.");
  }
  return payload as T;
}

function RequestCard({
  request,
  canManage,
  onChanged,
  onNotice,
}: {
  request: HubRequest;
  canManage: boolean;
  onChanged: () => void;
  onNotice: (message: string) => void;
}) {
  const [detail, setDetail] = useState<HubRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(request.previewUrl ?? "");
  const [commitSha, setCommitSha] = useState(request.previewSha ?? "");
  const [note, setNote] = useState("");
  const [domain, setDomain] = useState(request.targetDomain ?? "");

  const run = useCallback(
    async (key: string, path: string, body: Record<string, unknown>, success: string) => {
      setBusy(key);
      setError(null);
      try {
        await hubFetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        onNotice(success);
        onChanged();
        setDetail(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação.");
      } finally {
        setBusy(null);
      }
    },
    [onChanged, onNotice],
  );

  const loadDetail = useCallback(async () => {
    setBusy("detail");
    setError(null);
    try {
      setDetail(await hubFetch<HubRequest>(`/${request.id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
    } finally {
      setBusy(null);
    }
  }, [request.id]);

  const canPreview = canManage && request.status !== "PUBLISHED" && request.status !== "PUBLISH_REQUESTED";
  const canDecide = canManage && ["PREVIEW_READY", "APPROVED", "REJECTED"].includes(request.status);
  const canPublish = canManage && request.status === "APPROVED";
  const canConfirm = canManage && request.status === "PUBLISH_REQUESTED";

  return (
    <article className={cardTw} aria-label={`Pedido ${request.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <strong className="text-body-lg text-ink">{request.name}</strong>
          <span className="text-2xs text-ink-secondary">/{request.slug} · {KIND_LABEL[request.kind] ?? request.kind}</span>
        </div>
        <span className={pillTw}>{STATUS_LABEL[request.status] ?? request.status}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={mutedTw}>Atualizado em {dateBR(request.updatedAt)}</span>
        {request.previewUrl ? (
          <a className={mutedTw} href={request.previewUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={12} aria-hidden="true" /> Ver preview registrado
          </a>
        ) : null}
      </div>
      <div className={metaTw}>
        {request.targetDomain ? <span>Domínio de destino: {request.targetDomain}</span> : null}
        {request.repository ? <span>Repositório: {request.repository}</span> : null}
        {Object.entries(request.brief ?? {}).map(([key, value]) => (
          <span key={key}>{key}: {typeof value === "string" ? value : JSON.stringify(value)}</span>
        ))}
      </div>

      {error ? <p role="alert" className="text-body font-bold text-red-600">{error}</p> : null}

      {canPreview ? (
        <div className={panelTw}>
          <h3 className="text-body font-bold text-ink">Registrar preview</h3>
          <p className="text-2xs text-ink-secondary">A URL é evidência de versão, nunca uma publicação.</p>
          <label className={labelTw}>
            URL HTTPS do preview
            <input className={fieldTw} value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} placeholder="https://preview.example.com" />
          </label>
          <label className={labelTw}>
            Commit (opcional)
            <input className={fieldTw} value={commitSha} onChange={(event) => setCommitSha(event.target.value)} />
          </label>
          <button
            type="button"
            className={secondaryTw}
            disabled={busy !== null || !previewUrl.trim()}
            onClick={() => void run(`/${request.id}/preview`, { previewUrl: previewUrl.trim(), commitSha: commitSha.trim() || undefined }, "Preview registrado como nova versão.")}
          >
            {busy === "preview" ? <Loader2 className="animate-spin" size={15} aria-hidden="true" /> : null}
            Registrar preview
          </button>
        </div>
      ) : null}

      {canDecide ? (
        <div className={panelTw}>
          <h3 className="text-body font-bold text-ink">Decisão do cliente</h3>
          <label className={labelTw}>
            Observação (opcional)
            <textarea className={fieldTw} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryTw}
              disabled={busy !== null}
              onClick={() => void run(`/${request.id}/decision`, { decision: "APPROVED", note: note.trim() || undefined }, "Pedido aprovado.")}
            >
              Aprovar
            </button>
            <button
              type="button"
              className={secondaryTw}
              disabled={busy !== null}
              onClick={() => void run(`/${request.id}/decision`, { decision: "REJECTED", note: note.trim() || undefined }, "Pedido rejeitado.")}
            >
              Rejeitar
            </button>
          </div>
        </div>
      ) : null}

      {canPublish ? (
        <div className={panelTw}>
          <h3 className="text-body font-bold text-ink">Solicitar publicação</h3>
          <p className="text-2xs text-ink-secondary">Este botão apenas registra a solicitação. A publicação é executada fora da Véxora.</p>
          <label className={labelTw}>
            Domínio de destino
            <input className={fieldTw} value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="site.example.com" />
          </label>
          <button
            type="button"
            className={primaryTw}
            disabled={busy !== null || !domain.trim()}
            onClick={() => void run(`/${request.id}/publish-request`, { targetDomain: domain.trim() }, "Solicitação de publicação registrada; ainda sem evidência no ar.")}
          >
            Solicitar publicação
          </button>
        </div>
      ) : null}

      {canConfirm ? (
        <div className={panelTw}>
          <h3 className="text-body font-bold text-ink">Confirmar publicação</h3>
          <p className="text-2xs text-ink-secondary">A confirmação só é gravada se o domínio responder 2xx ao health-check. Nunca confirme por configuração.</p>
          <button
            type="button"
            className={primaryTw}
            disabled={busy !== null}
            onClick={() => void run(`/${request.id}/publish-confirm`, {}, "Publicação confirmada após resposta 2xx do domínio.")}
          >
            Verificar e confirmar
          </button>
        </div>
      ) : null}

      <button type="button" className={secondaryTw} disabled={busy !== null} onClick={() => void loadDetail()}>
        {busy === "detail" ? <Loader2 className="animate-spin" size={15} aria-hidden="true" /> : <ClipboardList size={15} aria-hidden="true" />}
        Ver versões e histórico
      </button>

      {detail ? (
        <section className={panelTw} aria-label={`Histórico do pedido ${request.name}`}>
          <h3 className="text-body font-bold text-ink">Versões</h3>
          {detail.versions?.length ? detail.versions.map((version) => (
            <p key={version.id} className="text-2xs text-ink-secondary">
              v{version.version} · {version.previewUrl}{version.commitSha ? ` · ${version.commitSha}` : ""} · {dateBR(version.createdAt)}
            </p>
          )) : <p className="text-2xs text-ink-secondary">Nenhuma versão registrada.</p>}
          <h3 className="text-body font-bold text-ink">Aprovações</h3>
          {detail.approvals?.length ? detail.approvals.map((approval) => (
            <p key={approval.id} className="text-2xs text-ink-secondary">
              {approval.decision} · {approval.note ?? "sem observação"} · {dateBR(approval.createdAt)}
            </p>
          )) : <p className="text-2xs text-ink-secondary">Nenhuma decisão registrada.</p>}
          <h3 className="text-body font-bold text-ink">Auditoria</h3>
          {detail.events?.length ? detail.events.map((event) => (
            <p key={event.id} className="text-2xs text-ink-secondary">
              {event.action} · {dateBR(event.createdAt)}
            </p>
          )) : <p className="text-2xs text-ink-secondary">Nenhum evento registrado.</p>}
        </section>
      ) : null}
    </article>
  );
}

export function SitesWorkspace({ canManage }: { canManage: boolean }) {
  const [requests, setRequests] = useState<HubRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [newRequest, setNewRequest] = useState({ name: "", slug: "", kind: "STATIC", brief: "", targetDomain: "" });

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    hubFetch<HubRequest[]>("")
      .then((value) => {
        if (live) setRequests(Array.isArray(value) ? value : []);
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os pedidos de sites.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const createRequest = useCallback(async () => {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const created = await hubFetch<HubRequest>("", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newRequest.name.trim(),
          slug: newRequest.slug.trim(),
          kind: newRequest.kind,
          targetDomain: newRequest.targetDomain.trim() || undefined,
          brief: newRequest.brief.trim() ? { objetivo: newRequest.brief.trim() } : {},
        }),
      });
      setNewRequest({ name: "", slug: "", kind: "STATIC", brief: "", targetDomain: "" });
      setNotice(`Pedido "${created.name}" registrado. Nenhum site foi publicado.`);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o pedido.");
    } finally {
      setCreating(false);
    }
  }, [newRequest, reload]);

  return (
    <section className={workspaceTw}>
      <header className={headingTw}>
        <div>
          <h1>Sites</h1>
          <p className={subtitleTw}>
            Acompanhe pedidos, previews, aprovações e publicações confirmadas. A Véxora não gera HTML nem publica páginas por conta própria.
          </p>
        </div>
        <button type="button" className={secondaryTw} onClick={reload} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Atualizar
        </button>
      </header>

      {notice ? <p role="status" className={pillTw}>{notice}</p> : null}

      {canManage ? (
        <section className={panelTw} aria-label="Novo pedido de site">
          <h2 className="text-body-lg font-bold text-ink">Novo pedido de site</h2>
          <div className={formGridTw}>
            <label className={labelTw}>
              Nome do pedido
              <input className={fieldTw} value={newRequest.name} onChange={(event) => setNewRequest({ ...newRequest, name: event.target.value })} />
            </label>
            <label className={labelTw}>
              Slug
              <input className={fieldTw} value={newRequest.slug} onChange={(event) => setNewRequest({ ...newRequest, slug: event.target.value })} placeholder="site-cliente" />
            </label>
            <label className={labelTw}>
              Tipo de site
              <select className={fieldTw} value={newRequest.kind} onChange={(event) => setNewRequest({ ...newRequest, kind: event.target.value })}>
                {KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
              </select>
            </label>
            <label className={labelTw}>
              Domínio de destino (opcional)
              <input className={fieldTw} value={newRequest.targetDomain} onChange={(event) => setNewRequest({ ...newRequest, targetDomain: event.target.value })} placeholder="site.example.com" />
            </label>
          </div>
          <label className={labelTw}>
            Objetivo do site
            <textarea className={fieldTw} rows={2} value={newRequest.brief} onChange={(event) => setNewRequest({ ...newRequest, brief: event.target.value })} />
          </label>
          <button
            type="button"
            className={primaryTw}
            disabled={creating || !newRequest.name.trim() || !newRequest.slug.trim()}
            onClick={() => void createRequest()}
          >
            {creating ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <ClipboardList size={16} aria-hidden="true" />}
            Registrar pedido
          </button>
        </section>
      ) : null}

      {error ? (
        <div role="alert" className={cardTw}>
          <p className="text-body font-bold text-red-600">{error}</p>
          <button type="button" className={secondaryTw} onClick={reload}>Tentar novamente</button>
        </div>
      ) : null}

      {loading ? (
        <p role="status" className="text-body text-ink-secondary">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" /> Carregando pedidos…
        </p>
      ) : null}

      {!loading && !error && requests.length === 0 ? (
        <div className={emptyTw}>
          <ClipboardList size={30} aria-hidden="true" />
          <h2>Nenhum pedido de site</h2>
          <p>Registre um pedido para acompanhar preview, aprovação e publicação confirmada.</p>
        </div>
      ) : null}

      {!loading && requests.length > 0 ? (
        <div className="grid grid-cols-1 gap-token lg:grid-cols-2">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} canManage={canManage} onChanged={reload} onNotice={setNotice} />
          ))}
        </div>
      ) : null}

      {!canManage ? (
        <p className="text-body text-ink-secondary">Somente responsáveis pela empresa podem registrar ou decidir pedidos de sites.</p>
      ) : null}
    </section>
  );
}
