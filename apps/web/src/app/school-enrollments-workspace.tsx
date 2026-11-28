"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, FileText, Link2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { schoolTw, StateBadge, dateLabel } from "./school-ui";

type Course = { id: string; name: string; level?: string | null; imageUrl?: string | null };
type Teacher = { id: string; name: string; phone?: string | null; email?: string | null };
type Template = { id: string; kind: string; name: string; source: string; variables: unknown; configuredAt: string | null; driveFileId: string | null };
type LinkRow = {
  id: string; token: string; url: string; status: string; ownerName: string; courseId: string | null;
  teacherId: string | null; weekday: number | null; startTime: string | null; durationMinutes: number | null;
  period: string | null; contractPeriod: string | null; contractedSessions: number | null;
  expiresAt: string | null; createdAt: string;
};
type Delivery = { id: string; recipientRole: string; status: string; error: string | null; sentAt: string | null };
type Submission = {
  id: string; studentName: string; status: string; createdAt: string; signedAt: string | null;
  signingUrl: string | null; documents: Array<{ id: string; kind: string; name: string }>;
  deliveries: Delivery[]; envelopes: Array<{ envelopeId: string; status: string }>;
};
type Overview = {
  courses: Course[]; teachers: Teacher[]; templates: Template[]; links: LinkRow[]; submissions: Submission[];
  readiness: { contractTemplate: boolean; formTemplate: boolean; documenso: boolean; whatsapp: boolean };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body?.message || "Não foi possível concluir esta operação.");
  return body;
}

const emptyTemplate = { kind: "CONTRACT", name: "Contrato de matrícula", bodyHtml: "", driveFileId: "" };
const emptyLink = {
  courseId: "", teacherId: "", weekday: "", startTime: "", durationMinutes: "50",
  period: "MANHA", contractPeriod: "MONTHLY", contractedSessions: "12",
  welcomeMessage: "", expiresAt: "",
};
const weekdays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

export function SchoolEnrollmentsWorkspace() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [templateForm, setTemplateForm] = useState({ ...emptyTemplate });
  const [linkForm, setLinkForm] = useState({ ...emptyLink });

  const load = useCallback(async () => {
    try {
      const result = await api<Overview>("school-enrollments/overview");
      setData(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as matrículas.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (event: FormEvent, path: string, payload: Record<string, unknown>, message: string) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(payload) });
      setNotice(message);
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setNotice("Link copiado. Confira antes de enviar ao cliente."); }
    catch { setNotice("Copie o link manualmente quando o navegador não permitir a área de transferência."); }
  };

  const readiness = data?.readiness;
  const readyItems = [
    { label: "Modelo do contrato", ok: Boolean(readiness?.contractTemplate), icon: <FileText size={16} aria-hidden="true" /> },
    { label: "Modelo da ficha", ok: Boolean(readiness?.formTemplate), icon: <ClipboardCopy size={16} aria-hidden="true" /> },
    { label: "Documenso", ok: Boolean(readiness?.documenso), icon: <ShieldCheck size={16} aria-hidden="true" /> },
    { label: "WhatsApp conectado", ok: Boolean(readiness?.whatsapp), icon: <Send size={16} aria-hidden="true" /> },
  ];

  return (
    <section className={schoolTw.shell} aria-label="Matrículas e documentos">
      <div className={schoolTw.hero}>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">Matrícula externa</p>
          <h2 className={schoolTw.heroTitle}>Do link à assinatura, com estado honesto</h2>
          <p className={schoolTw.heroCopy}>O cliente preenche os dados no celular e assina no Documenso. Contrato e ficha só são gerados após confirmação da assinatura. Envio só aparece como concluído quando o WhatsApp confirmar.</p>
        </div>
        <button type="button" className={schoolTw.buttonSoft} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" /> Atualizar</button>
      </div>

      <div className={schoolTw.metricGrid}>
        {readyItems.map((item) => (
          <article key={item.label} className={schoolTw.metric} data-testid={`readiness-${item.label}`}>
            <span className={`${schoolTw.metricIcon} ${item.ok ? "" : "bg-amber-100 text-amber-600"}`} aria-hidden="true">{item.icon}</span>
            <span className={schoolTw.metricLabel}>{item.label}</span>
            <strong className="text-base font-extrabold text-slate-950">{item.ok ? "Configurado" : "Pendente"}</strong>
            <span className={schoolTw.metricHint}>{item.ok ? "Pronto para o fluxo" : "Nenhuma ação externa foi executada"}</span>
          </article>
        ))}
      </div>

      {error ? <p role="status" className="rounded-xl border border-red-100 bg-red-100 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-600">{notice}</p> : null}

      <div className={schoolTw.grid}>
        <details className={schoolTw.card} data-testid="enrollment-template-form">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">Modelos do Drive com variáveis</summary>
          <form className="grid gap-3" onSubmit={(event) => void run(event, "school-enrollments/templates", templateForm, "Modelo salvo para esta escola.")}>
            <label className={schoolTw.label}>Tipo
              <select className={schoolTw.select} value={templateForm.kind} onChange={(event) => setTemplateForm({ ...templateForm, kind: event.target.value })}>
                <option value="CONTRACT">Contrato</option>
                <option value="ENROLLMENT_FORM">Ficha de matrícula</option>
              </select>
            </label>
            <label className={schoolTw.label}>Nome<input className={schoolTw.input} required value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} /></label>
            <label className={schoolTw.label}>ID do arquivo no Google Drive (opcional)<input className={schoolTw.input} placeholder="Somente identifique; a importação automática não é afirmada" value={templateForm.driveFileId} onChange={(event) => setTemplateForm({ ...templateForm, driveFileId: event.target.value })} /></label>
            <label className={schoolTw.label}>Texto copiado do modelo<textarea className={schoolTw.textarea} required rows={6} placeholder={"Use variáveis como {{nome_aluno}}, {{curso}}, {{mensalidade}}"} value={templateForm.bodyHtml} onChange={(event) => setTemplateForm({ ...templateForm, bodyHtml: event.target.value })} /></label>
            <p className={schoolTw.note}>Variáveis detectadas: {(templateForm.bodyHtml.match(/\{\{[a-z0-9_]+\}\}/gi) || []).length}</p>
            <button className={schoolTw.button} type="submit" disabled={busy}>Salvar modelo</button>
          </form>
        </details>

        <details className={schoolTw.card} data-testid="enrollment-link-form">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">Novo link de matrícula</summary>
          <form className="grid gap-3" onSubmit={(event) => void run(event, "school-enrollments/links", linkForm, "Link criado. Copie e envie ao cliente.")}>
            <label className={schoolTw.label}>Matéria/curso
              <select className={schoolTw.select} required value={linkForm.courseId} onChange={(event) => setLinkForm({ ...linkForm, courseId: event.target.value })}>
                <option value="">Selecione</option>
                {(data?.courses || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className={schoolTw.label}>Professor responsável
              <select className={schoolTw.select} required value={linkForm.teacherId} onChange={(event) => setLinkForm({ ...linkForm, teacherId: event.target.value })}>
                <option value="">Selecione</option>
                {(data?.teachers || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={schoolTw.label}>Dia da semana
                <select className={schoolTw.select} required value={linkForm.weekday} onChange={(event) => setLinkForm({ ...linkForm, weekday: event.target.value })}>
                  <option value="">Selecione</option>
                  {weekdays.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                </select>
              </label>
              <label className={schoolTw.label}>Horário<input className={schoolTw.input} type="time" required value={linkForm.startTime} onChange={(event) => setLinkForm({ ...linkForm, startTime: event.target.value })} /></label>
              <label className={schoolTw.label}>Duração da aula (minutos)<input className={schoolTw.input} type="number" min={30} max={240} required value={linkForm.durationMinutes} onChange={(event) => setLinkForm({ ...linkForm, durationMinutes: event.target.value })} /></label>
              <label className={schoolTw.label}>Turno
                <select className={schoolTw.select} value={linkForm.period} onChange={(event) => setLinkForm({ ...linkForm, period: event.target.value })}>
                  <option value="MANHA">Manhã</option><option value="TARDE">Tarde</option><option value="NOITE">Noite</option>
                </select>
              </label>
              <label className={schoolTw.label}>Período contratual
                <select className={schoolTw.select} value={linkForm.contractPeriod} onChange={(event) => setLinkForm({ ...linkForm, contractPeriod: event.target.value })}>
                  <option value="MONTHLY">Mensal</option><option value="QUARTERLY">Trimestral</option><option value="SEMESTER">Semestral</option><option value="YEARLY">Anual</option>
                </select>
              </label>
              <label className={schoolTw.label}>Aulas contratadas<input className={schoolTw.input} type="number" min={1} max={1000} required value={linkForm.contractedSessions} onChange={(event) => setLinkForm({ ...linkForm, contractedSessions: event.target.value })} /></label>
            </div>
            <label className={schoolTw.label}>Mensagem de boas-vindas<textarea className={schoolTw.textarea} rows={3} value={linkForm.welcomeMessage} onChange={(event) => setLinkForm({ ...linkForm, welcomeMessage: event.target.value })} /></label>
            <button className={schoolTw.button} type="submit" disabled={busy}><Link2 size={16} aria-hidden="true" /> Criar link</button>
          </form>
        </details>
      </div>

      <div className={schoolTw.section}>
        <div className={schoolTw.sectionHead}>
          <h3 className={schoolTw.sectionTitle}><Link2 size={18} aria-hidden="true" /> Links gerados</h3>
          <p className={schoolTw.sectionHint}>O link já chega com curso e professor responsável — nunca com dados pessoais da aluna.</p>
        </div>
        {(data?.links || []).length === 0 ? <p className={schoolTw.empty}>Nenhum link criado.</p> : (
          <div className={schoolTw.list}>
            {data!.links.map((link) => (
              <article key={link.id} className={schoolTw.row} data-testid={`enrollment-link-${link.id}`}>
                <div className="grid min-w-0 gap-1">
                  <strong className="truncate text-sm font-bold text-slate-950">{link.ownerName} · {data?.courses.find((item) => item.id === link.courseId)?.name || "Curso aberto"}</strong>
                  <code className="block truncate text-xs text-slate-500">{link.url || `/m/${link.token}`}</code>
                  <span className={schoolTw.note}>
                    {link.weekday ? weekdays[link.weekday - 1] : "Dia a definir"}{link.startTime ? ` · ${link.startTime}` : ""} · {link.contractPeriod || "período a definir"}
                    {" · "}Criado em {dateLabel(link.createdAt)} · status {link.status}
                  </span>
                </div>
                <div className={schoolTw.actions}>
                  <button type="button" className={schoolTw.buttonSoft} onClick={() => void copy(link.url)}><ClipboardCopy size={15} aria-hidden="true" /> Copiar</button>
                  <button type="button" className={schoolTw.buttonSoft} onClick={() => void run({ preventDefault() {} } as FormEvent, `school-enrollments/links/${link.id}/rotate`, {}, "Link renovado.")}><RefreshCw size={15} aria-hidden="true" /> Renovar</button>
                  <button type="button" className={schoolTw.buttonSoft} onClick={() => void run({ preventDefault() {} } as FormEvent, `school-enrollments/links/${link.id}/status`, { status: link.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }, "Status atualizado.")}>{link.status === "ACTIVE" ? "Pausar" : "Ativar"}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={schoolTw.section}>
        <div className={schoolTw.sectionHead}>
          <h3 className={schoolTw.sectionTitle}><ShieldCheck size={18} aria-hidden="true" /> Matrículas e entregas</h3>
          <p className={schoolTw.sectionHint}>Assinatura confirmada, documento gerado e envio confirmado são estados diferentes.</p>
        </div>
        {(data?.submissions || []).length === 0 ? <p className={schoolTw.empty}>Nenhuma matrícula enviada pelo link yet.</p> : (
          <div className={schoolTw.list}>
            {data!.submissions.map((submission) => (
              <article key={submission.id} className={schoolTw.row} data-testid={`enrollment-submission-${submission.id}`}>
                <div className="grid min-w-0 gap-1">
                  <strong className="truncate text-sm font-bold text-slate-950">{submission.studentName}</strong>
                  <span className={schoolTw.note}>{dateLabel(submission.createdAt)} · assinado {submission.signedAt ? dateLabel(submission.signedAt) : "ainda não"}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <StateBadge state={submission.status} />
                    {submission.documents.map((document) => <span key={document.id} className={schoolTw.chip}><FileText size={13} aria-hidden="true" /> {document.kind}</span>)}
                  </div>
                  {submission.deliveries.length ? (
                    <p className={schoolTw.note}>
                      {submission.deliveries.map((delivery) => `${delivery.recipientRole}: ${delivery.status}${delivery.error ? ` (${delivery.error})` : ""}`).join(" · ")}
                    </p>
                  ) : null}
                </div>
                {submission.signingUrl ? <a className={schoolTw.buttonSoft} href={submission.signingUrl} target="_blank" rel="noreferrer">Abrir assinatura</a> : null}
              </article>
            ))}
          </div>
        )}
      </div>

      {!readiness?.documenso ? <p className={schoolTw.note}><AlertTriangle size={14} aria-hidden="true" /> Sem Documenso configurado, o formulário registra a submissão como PREPARED e não afirma que o contrato foi enviado.</p> : null}
      {!readiness?.whatsapp ? <p className={schoolTw.note}><AlertTriangle size={14} aria-hidden="true" /> Sem WhatsApp conectado, os documentos ficam gerados e as entregas PREPARED — nenhum envio é reivindicado.</p> : null}
      {readiness?.documenso && readiness?.whatsapp ? <p className={schoolTw.note}><CheckCircle2 size={14} aria-hidden="true" /> Integrações configuradas. Ainda assim, somente uma resposta confirmada do provedor marca envio como concluído.</p> : null}
    </section>
  );
}
