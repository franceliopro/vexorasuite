"use client";

/**
 * Briefings criativos — intake estruturado, não estúdio de geração.
 *
 * A Véxora recebe e registra os insumos aprovados. Não gera arte, não aprova
 * peça, não publica e não entrega nada. A execução fica fora da plataforma.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardList, Loader2, RefreshCw } from "lucide-react";

const workspaceTw = "grid gap-token";
const headingTw = "flex flex-wrap items-start justify-between gap-4";
const subtitleTw = "mt-1 max-w-crm-copy text-body leading-relaxed text-ink-secondary";
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const cardTw = "grid min-w-0 gap-3 rounded-token border border-line bg-surface p-pad text-ink shadow-token-sm";
const panelTw = "grid gap-3 rounded-token-sm border border-line bg-surface-2 p-pad";
const emptyTw = "grid place-items-center gap-2 rounded-token border border-line bg-surface px-6 py-10 text-center text-ink shadow-token-sm";
const pillTw = "inline-flex min-h-6 items-center gap-1 rounded-full bg-blue-50 px-2.5 text-2xs font-bold text-blue-800";
const fieldTw = "min-h-control w-full rounded-token-sm border border-line bg-surface-2 px-3 text-body text-ink outline-hidden focus:border-blue-600";
const textareaTw = "min-h-24 w-full rounded-token-sm border border-line bg-surface-2 px-3 py-2 text-body text-ink outline-hidden focus:border-blue-600";
const labelTw = "grid gap-1 text-body font-bold text-ink";
const hintTw = "text-2xs leading-relaxed text-ink-secondary";
const formGridTw = "grid grid-cols-1 gap-token md:grid-cols-2";
const metaTw = "grid gap-1 text-2xs text-ink-secondary";

type BriefEvent = { id: string; action: string; createdAt: string; details: Record<string, unknown> | null };
type Brief = {
  id: string;
  title: string;
  objective: string;
  channelFormat: string;
  identity: string;
  approvedSource: string;
  deadline: string;
  approver: string;
  destination: string;
  status: string;
  createdAt: string;
  events?: BriefEvent[];
};

type FormState = {
  title: string;
  objective: string;
  channelFormat: string;
  identity: string;
  approvedSource: string;
  deadline: string;
  approver: string;
  destination: string;
};

const emptyForm: FormState = {
  title: "",
  objective: "",
  channelFormat: "",
  identity: "",
  approvedSource: "",
  deadline: "",
  approver: "",
  destination: "",
};

async function briefFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/marketing/creative-briefs${path}`, {
    cache: "no-store",
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Não foi possível concluir a operação.");
  }
  return data as T;
}

export function CreativeBriefWorkspace({ canManage }: { canManage: boolean }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [histories, setHistories] = useState<Record<string, BriefEvent[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setBriefs(await briefFetch<Brief[]>(""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os briefings.");
    }
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  const change = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await briefFetch<Brief>("", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setNotice("Briefing registrado. Nenhuma peça foi criada, aprovada, publicada ou entregue.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o briefing.");
    } finally {
      setBusy(false);
    }
  };

  const showHistory = async (id: string) => {
    try {
      const detail = await briefFetch<Brief>(`/${id}`);
      setHistories((current) => ({ ...current, [id]: detail.events ?? [] }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o histórico.");
    }
  };

  return (
    <section className={workspaceTw} data-testid="creative-brief-workspace" aria-label="Briefing criativo">
      <header className={headingTw}>
        <div>
          <h1>Briefings criativos</h1>
          <p className={subtitleTw}>
            Registre o briefing completo antes de qualquer produção. A Véxora guarda os insumos,
            o aprovador e o destino; a criação e a publicação acontecem fora da plataforma.
          </p>
        </div>
        <button type="button" className={secondaryTw} onClick={() => void load()} disabled={!canManage || busy} aria-label="Atualizar briefings">
          <RefreshCw size={16} aria-hidden="true" /> Atualizar
        </button>
      </header>

      <div className={cardTw} role="note">
        <p className={hintTw}>
          Status do fluxo: somente recebido. Não existe aprovação de peça, geração de arte,
          publicação ou entrega automatizada a partir deste registro.
        </p>
      </div>

      {!canManage ? (
        <section className={cardTw}><h2>Acesso restrito</h2><p>Somente a administração pode registrar briefings.</p></section>
      ) : (
        <>
          {error ? <p role="alert" className={cardTw}>{error}</p> : null}
          {notice ? <p role="status" className={cardTw}>{notice}</p> : null}

          <form className={cardTw} data-testid="creative-brief-form" onSubmit={(event) => void submit(event)}>
            <div>
              <h2>Registrar briefing</h2>
              <p className={hintTw}>Todos os campos são obrigatórios. Um rascunho incompleto não é aceito.</p>
            </div>
            <div className={formGridTw}>
              <label className={labelTw}>
                Título
                <input className={fieldTw} data-testid="creative-brief-title" required maxLength={120} value={form.title} onChange={change("title")} />
              </label>
              <label className={labelTw}>
                Objetivo
                <textarea className={textareaTw} data-testid="creative-brief-objective" required maxLength={2000} value={form.objective} onChange={change("objective")} />
              </label>
              <label className={labelTw}>
                Canal e formato
                <input className={fieldTw} data-testid="creative-brief-channel-format" required maxLength={500} value={form.channelFormat} onChange={change("channelFormat")} />
              </label>
              <label className={labelTw}>
                Identidade da marca
                <textarea className={textareaTw} data-testid="creative-brief-identity" required maxLength={2000} value={form.identity} onChange={change("identity")} />
              </label>
              <label className={labelTw}>
                Texto ou fonte aprovada
                <textarea className={textareaTw} data-testid="creative-brief-approved-source" required maxLength={4000} value={form.approvedSource} onChange={change("approvedSource")} />
              </label>
              <label className={labelTw}>
                Data limite
                <input className={fieldTw} data-testid="creative-brief-deadline" type="date" required value={form.deadline} onChange={change("deadline")} />
              </label>
              <label className={labelTw}>
                Aprovador responsável
                <input className={fieldTw} data-testid="creative-brief-approver" required maxLength={160} value={form.approver} onChange={change("approver")} />
              </label>
              <label className={labelTw}>
                Destino e publicador
                <input className={fieldTw} data-testid="creative-brief-destination" required maxLength={500} value={form.destination} onChange={change("destination")} />
              </label>
            </div>
            <button type="submit" className={primaryTw} data-testid="creative-brief-submit" disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ClipboardList size={15} aria-hidden="true" />}
              {busy ? "Registrando…" : "Registrar briefing"}
            </button>
          </form>

          <section className={cardTw} data-testid="creative-brief-list" aria-label="Briefings registrados">
            <h2>Briefings registrados</h2>
            {briefs.length ? briefs.map((brief) => (
              <article className={panelTw} key={brief.id} data-testid="creative-brief-item">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className={metaTw}>
                    <strong className="text-body text-ink">{brief.title}</strong>
                    <span>{brief.channelFormat}</span>
                    <span>Prazo: {brief.deadline.slice(0, 10)} · Aprovador: {brief.approver}</span>
                    <span>Destino: {brief.destination}</span>
                  </div>
                  <span className={pillTw}>Recebido</span>
                </div>
                <details className={panelTw}>
                  <summary>Histórico e conteúdo do briefing</summary>
                  <p className={hintTw}>Objetivo: {brief.objective}</p>
                  <p className={hintTw}>Identidade: {brief.identity}</p>
                  <p className={hintTw}>Fonte aprovada: {brief.approvedSource}</p>
                  <button type="button" className={secondaryTw} onClick={() => void showHistory(brief.id)}>
                    Carregar eventos de auditoria
                  </button>
                  {(histories[brief.id] ?? []).map((event) => (
                    <p className={hintTw} key={event.id}>{event.action} — {event.createdAt}</p>
                  ))}
                </details>
              </article>
            )) : (
              <div className={emptyTw} data-testid="creative-brief-empty">
                <ClipboardList size={28} aria-hidden="true" />
                <p>Nenhum briefing registrado nesta empresa.</p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
