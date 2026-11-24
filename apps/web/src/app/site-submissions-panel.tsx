"use client";

/**
 * Anúncios — submissões do formulário público lidas do Directus pela API da
 * Véxora. A decisão humana é auditada aqui; criação do imóvel, snapshot e envio
 * ao anunciante são execuções externas, nunca afirmadas por este painel.
 */

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";

const cardTw = "grid min-w-0 gap-3 rounded-token border border-line bg-surface p-pad text-ink shadow-token-sm";
const panelTw = "grid gap-3 rounded-token-sm border border-line bg-surface-2 p-pad";
const emptyTw = "grid place-items-center gap-2 rounded-token border border-line bg-surface px-6 py-10 text-center text-ink shadow-token-sm";
const pillTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-blue-50 px-2.5 text-2xs font-bold text-blue-800";
const mutedTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-2xs font-bold text-ink-secondary";
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const fieldTw = "min-h-control w-full rounded-token-sm border border-line bg-surface-2 px-3 text-body text-ink outline-hidden focus:border-blue-600";
const labelTw = "grid gap-1 text-body font-bold text-ink";
const metaTw = "grid gap-1 text-2xs text-ink-secondary";

type SubmissionDecision = {
  decision: string;
  reason: string | null;
  actorId: string;
  status: string;
  lastError: string | null;
  decidedAt: string | null;
};

type Submission = {
  id: string;
  submission_key: string;
  name: string;
  email: string;
  phone: string | null;
  payload: Record<string, unknown>;
  status: string;
  rejection_reason: string | null;
  property_id: string | null;
  date_created: string;
  date_updated: string | null;
  decision: SubmissionDecision | null;
};

type SubmissionList = {
  configured: boolean;
  notification: { status: string; message: string };
  submissions: Submission[];
};

type FetchError = Error & { status?: number };

const DECISION_LABEL: Record<string, string> = {
  APPROVED: "Aprovado na Véxora",
  REJECTED: "Rejeitado na Véxora",
  PROCESSING: "Decisão em andamento",
  FAILED: "Falha ao registrar decisão",
};

function show(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "—";
}

function dateBR(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
}

async function submissionsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/sites/hub/submissions${path}`, {
    cache: "no-store",
    ...init,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload?.message === "string"
      ? payload.message
      : "Não foi possível concluir a operação com anúncios.";
    const error = new Error(message) as FetchError;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

function SubmissionCard({
  submission,
  canManage,
  onChanged,
  onNotice,
}: {
  submission: Submission;
  canManage: boolean;
  onChanged: () => void;
  onNotice: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payload: Record<string, unknown> = submission.payload ?? {};
  const canDecide = canManage && submission.status === "pending" && !submission.decision;

  const decide = useCallback(
    async (decision: "APPROVED" | "REJECTED") => {
      const clean = reason.trim();
      if (decision === "REJECTED" && !clean) return;
      setBusy(true);
      setError(null);
      try {
        await submissionsFetch(`/${encodeURIComponent(submission.submission_key)}/decide`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, reason: clean || undefined }),
        });
        setReason("");
        onNotice("Decisão registrada na Véxora. Envio ao anunciante ainda não confirmado.");
        onChanged();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Não foi possível registrar a decisão.");
      } finally {
        setBusy(false);
      }
    },
    [reason, submission.submission_key, onChanged, onNotice],
  );

  return (
    <article className={cardTw} aria-label={`Anúncio ${show(payload.title ?? submission.name)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <strong className="text-body-lg text-ink">{show(payload.title ?? submission.name)}</strong>
          <span className="text-2xs text-ink-secondary">{show(submission.name)} · {show(submission.email)}</span>
        </div>
        <span className={pillTw}>
          {submission.decision ? DECISION_LABEL[submission.decision.status] ?? submission.decision.status : "Aguardando decisão"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={mutedTw}>Código: {show(payload.code)}</span>
        <span className={mutedTw}>Categoria: {show(payload.category)}</span>
        <span className={mutedTw}>Pretensão: {show(payload.purpose)}</span>
        <span className={mutedTw}>Recebido em {dateBR(submission.date_created)}</span>
      </div>

      {submission.decision ? (
        <p className={metaTw}>
          {submission.decision.decision} · {submission.decision.reason ?? "sem motivo"} · {dateBR(submission.decision.decidedAt)}
        </p>
      ) : null}

      {submission.decision?.lastError ? (
        <p role="alert" className="text-body font-bold text-red-600">{submission.decision.lastError}</p>
      ) : null}

      {error ? <p role="alert" className="text-body font-bold text-red-600">{error}</p> : null}

      {canDecide ? (
        <div className={panelTw}>
          <h3 className="text-body font-bold text-ink">Decisão do anúncio</h3>
          <p className="text-2xs text-ink-secondary">A rejeição exige motivo. A aprovação encaminha o imóvel ao fluxo do Directus; nada é publicado por aqui.</p>
          <label className={labelTw}>
            Motivo (obrigatório para rejeitar)
            <textarea className={fieldTw} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryTw}
              disabled={busy}
              onClick={() => void decide("APPROVED")}
            >
              {busy ? <Loader2 className="animate-spin" size={15} aria-hidden="true" /> : null}
              Aprovar
            </button>
            <button
              type="button"
              className={secondaryTw}
              disabled={busy || !reason.trim()}
              onClick={() => void decide("REJECTED")}
            >
              Rejeitar
            </button>
          </div>
        </div>
      ) : null}

      <details className={panelTw}>
        <summary className="text-body font-bold text-ink">Detalhes da submissão</summary>
        <p className={metaTw}>Telefone: {show(submission.phone)} · E-mail: {show(submission.email)}</p>
        <pre className="text-2xs text-ink-secondary">{JSON.stringify(payload, null, 2)}</pre>
      </details>
    </article>
  );
}

export function SiteSubmissionsPanel({ canManage }: { canManage: boolean }) {
  const [list, setList] = useState<SubmissionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    submissionsFetch<SubmissionList>("")
      .then((value) => {
        if (live) setList(value);
      })
      .catch((cause: unknown) => {
        if (live) {
          setError(cause instanceof Error
            ? cause as FetchError
            : new Error("Não foi possível carregar os anúncios.") as FetchError);
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt, canManage]);

  if (!canManage) return null;

  return (
    <section className={cardTw} aria-label="Anúncios">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-body-lg font-bold text-ink">Anúncios</h2>
          <p className="text-2xs text-ink-secondary">
            Submissões do formulário público. A Véxora registra a decisão; o Directus cria o imóvel e notifica o anunciante.
          </p>
        </div>
        <button type="button" className={secondaryTw} onClick={reload} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" /> Atualizar anúncios
        </button>
      </header>

      {notice ? <p role="status" className={pillTw}>{notice}</p> : null}

      {error?.status === 503 ? (
        <p className={mutedTw}>{error.message}</p>
      ) : error ? (
        <div role="alert" className={cardTw}>
          <p className="text-body font-bold text-red-600">{error.message ?? "Não foi possível carregar os anúncios."}</p>
          <button type="button" className={secondaryTw} onClick={reload}>Tentar novamente</button>
        </div>
      ) : null}

      {loading ? (
        <p role="status" className="text-body text-ink-secondary">
          <Loader2 className="animate-spin" size={16} aria-hidden="true" /> Carregando anúncios…
        </p>
      ) : null}

      {list && !loading && !error ? (
        <>
          <p className={metaTw}>{list.notification.message}</p>
          {list.submissions.length === 0 ? (
            <div className={emptyTw}>
              <ClipboardList size={30} aria-hidden="true" />
              <h3>Nenhum anúncio pendente</h3>
              <p>Novas submissões do formulário público aparecerão aqui para decisão.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-token lg:grid-cols-2">
              {list.submissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  canManage={canManage}
                  onChanged={reload}
                  onNotice={setNotice}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
