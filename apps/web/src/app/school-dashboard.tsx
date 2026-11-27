"use client";
import { useEffect, useState } from "react";
import { BellRing, CalendarDays, ClipboardCheck, GraduationCap, UsersRound, Wallet } from "lucide-react";

type Snapshot = {
  courses?: Array<{ id: string }>;
  people?: Array<{ id: string; kind: string }>;
  classes?: Array<{ id: string; name?: string }>;
  enrollments?: Array<{ id: string; status?: string }>;
  sessions?: Array<{ id: string; sessionDate: string; summaryHtml?: string | null }>;
  balances?: Array<{
    enrollmentId: string;
    overdueInstallments?: number;
    cancellationStatus?: string;
    penaltyCents?: number | null;
    tuition?: { amountCents?: number | null; nextDueDate?: string | null };
  }>;
  stats?: {
    students?: { percentage?: number; present?: number; absences?: number };
    teachers?: { percentage?: number; present?: number; absences?: number };
  };
  billingPolicy?: {
    paymentReminderDaysBefore?: number;
    remindOnDueDate?: boolean;
    remindDailyWhenOverdue?: boolean;
    channels?: string[];
    consentRequired?: boolean;
    teacherReminderMinutesBefore?: number;
    cancellationApprovalRequired?: boolean;
    overdueInstallmentsForCancellation?: number;
    breachPenaltyPercent?: number;
    paymentNoticeToManager?: boolean;
    paymentNoticeToAdmins?: boolean;
  };
};

const shellTw = "grid w-full gap-4";
const heroTw = "flex flex-wrap items-start gap-3 rounded-xl border border-gray-200 bg-white p-5";
const heroIconTw = "grid size-10 flex-none place-items-center rounded-lg bg-blue-50 text-blue-700";
const titleTw = "m-0 text-lg font-bold text-slate-900";
const copyTw = "mb-0 mt-1 max-w-3xl text-sm leading-relaxed text-slate-600";
const gridTw = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4";
const cardTw = "grid min-w-0 content-start gap-1 rounded-xl border border-gray-200 bg-white p-4";
const cardLabelTw = "text-xs font-bold uppercase tracking-wide text-slate-500";
const cardValueTw = "text-2xl font-extrabold text-slate-900";
const cardHintTw = "text-xs text-slate-600";
const actionsTw = "flex flex-wrap gap-2";
const buttonTw = "inline-flex min-h-control items-center justify-center rounded-lg bg-blue-600 px-3.5 text-sm font-bold text-white transition-colors hover:bg-blue-700";
const buttonSoftTw = "inline-flex min-h-control items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-bold text-slate-700 transition-colors hover:bg-gray-50";
const detailsTw = "rounded-xl border border-gray-200 bg-white px-4 py-3";
const summaryTw = "cursor-pointer text-sm font-bold text-slate-900";
const listTw = "grid gap-2 p-0 text-sm text-slate-700";
const rowTw = "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2";
const noteTw = "m-0 text-xs leading-relaxed text-slate-500";
const emptyTw = "p-0 text-sm text-slate-600";

const money = (value?: number | null) => typeof value === "number"
  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100)
  : "—";
const date = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
};
const stripHtml = (value?: string | null) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function SchoolDashboard({ onNavigate, vocabulary }: { onNavigate: (target: string) => void; vocabulary?: Record<string, string> }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const load = () => fetch("/api/backend/school/snapshot", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Snapshot>; })
      .then((data) => { if (live) { setSnapshot(data); setError(""); } })
      .catch(() => { if (live) setError("Não foi possível carregar os dados escolares agora."); });
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);

  const people = snapshot?.people || [];
  const classes = snapshot?.classes || [];
  const sessions = snapshot?.sessions || [];
  const enrollments = snapshot?.enrollments || [];
  const balances = snapshot?.balances || [];
  const policy = snapshot?.billingPolicy;
  const overdue = balances.reduce((total, item) => total + Math.max(0, Number(item.overdueInstallments || 0)), 0);
  const suggested = balances.filter((item) => item.cancellationStatus === "SUGGESTED").length;
  const attendance = snapshot?.stats?.students?.percentage ?? 0;

  return (
    <section className={shellTw} aria-label="Visão geral escolar">
      <div className={heroTw}>
        <span className={heroIconTw}><GraduationCap size={22} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 className={titleTw}>Visão geral da escola</h2>
          <p className={copyTw}>Acompanhe turmas, aulas, presença e mensalidades da sua operação. Lembretes e cobranças aparecem como configuração ou agendamento até haver evidência de envio e confirmação.</p>
        </div>
      </div>

      <div className={gridTw}>
        <article className={cardTw}>
          <span className={cardLabelTw}>{vocabulary?.aluno || "Alunos"}</span>
          <strong className={cardValueTw}>{people.filter((person) => person.kind === "STUDENT").length}</strong>
          <span className={cardHintTw}>{enrollments.length} matrícula(s) cadastrada(s)</span>
        </article>
        <article className={cardTw}>
          <span className={cardLabelTw}>{vocabulary?.professor || "Professores"}</span>
          <strong className={cardValueTw}>{people.filter((person) => person.kind === "TEACHER").length}</strong>
          <span className={cardHintTw}>{classes.length} turma(s) ativa(s)</span>
        </article>
        <article className={cardTw}>
          <span className={cardLabelTw}>{vocabulary?.aula || "Aulas"} e presença</span>
          <strong className={cardValueTw}>{attendance}%</strong>
          <span className={cardHintTw}>{sessions.length} aula(s) · {snapshot?.stats?.students?.present || 0} presença(s) · {snapshot?.stats?.students?.absences || 0} falta(s)</span>
        </article>
        <article className={cardTw}>
          <span className={cardLabelTw}>{vocabulary?.mensalidade || "Mensalidades"}</span>
          <strong className={cardValueTw}>{overdue}</strong>
          <span className={cardHintTw}>{suggested} sugestão(ões) de cancelamento aguardando decisão</span>
        </article>
      </div>

      <div className={actionsTw}>
        <button type="button" className={buttonTw} onClick={() => onNavigate("Gestão escolar")}><ClipboardCheck size={16} aria-hidden="true" /> Abrir gestão escolar</button>
        <button type="button" className={buttonSoftTw} onClick={() => onNavigate("Financeiro")}><Wallet size={16} aria-hidden="true" /> Ver mensalidades</button>
        <button type="button" className={buttonSoftTw} onClick={() => onNavigate("Automação")}><BellRing size={16} aria-hidden="true" /> Regras de lembrete</button>
        <button type="button" className={buttonSoftTw} onClick={() => onNavigate("Chatbots")}><UsersRound size={16} aria-hidden="true" /> Chatbot da escola</button>
      </div>

      {error ? <p role="status" className={noteTw}>{error}</p> : null}

      <details className={detailsTw}>
        <summary className={summaryTw}>Últimas aulas e resumos</summary>
        {sessions.length ? (
          <ul className={`${listTw} mt-3`}>
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id} className={rowTw}>
                <span className="inline-flex items-center gap-2"><CalendarDays size={15} aria-hidden="true" /> {date(session.sessionDate)}</span>
                <span className="text-xs text-slate-600">{stripHtml(session.summaryHtml) || "Sem resumo registrado"}</span>
              </li>
            ))}
          </ul>
        ) : <p className={`${emptyTw} mt-3`}>Nenhuma aula registrada até agora.</p>}
      </details>

      <details className={detailsTw}>
        <summary className={summaryTw}>Pendências financeiras</summary>
        {balances.some((item) => Number(item.overdueInstallments || 0) > 0 || item.cancellationStatus === "SUGGESTED") ? (
          <ul className={`${listTw} mt-3`}>
            {balances.filter((item) => Number(item.overdueInstallments || 0) > 0 || item.cancellationStatus === "SUGGESTED").slice(0, 6).map((item) => (
              <li key={item.enrollmentId} className={rowTw}>
                <span>{Number(item.overdueInstallments || 0)} mensalidade(s) em atraso · vencimento {date(item.tuition?.nextDueDate)}</span>
                <span className="text-xs text-slate-600">{item.cancellationStatus === "SUGGESTED" ? "Cancelamento sugerido — aguardando aprovação" : `Multa prevista: ${money(item.penaltyCents)}`}</span>
              </li>
            ))}
          </ul>
        ) : <p className={`${emptyTw} mt-3`}>Nenhuma pendência financeira registrada. Nenhuma cobrança foi enviada por esta visão.</p>}
      </details>

      <details className={detailsTw}>
        <summary className={summaryTw}>Regras vigentes da escola</summary>
        {policy ? (
          <ul className={`${listTw} mt-3`}>
            <li className={rowTw}><span>Lembrete de mensalidade</span><span className="text-xs text-slate-600">{policy.paymentReminderDaysBefore} dia(s) antes, no vencimento e diariamente em atraso: {policy.remindOnDueDate || policy.remindDailyWhenOverdue ? "configurado" : "desativado"}</span></li>
            <li className={rowTw}><span>Canais permitidos</span><span className="text-xs text-slate-600">{(policy.channels || []).join(", ") || "nenhum"} · consentimento {policy.consentRequired ? "obrigatório" : "não exigido"}</span></li>
            <li className={rowTw}><span>Aviso ao professor</span><span className="text-xs text-slate-600">{policy.teacherReminderMinutesBefore} min antes da aula · configuração, sem envio confirmado</span></li>
            <li className={rowTw}><span>Cancelamento e multa</span><span className="text-xs text-slate-600">{policy.overdueInstallmentsForCancellation} mensalidade(s) · {policy.breachPenaltyPercent}% sobre total menos pago · {policy.cancellationApprovalRequired ? "só com aprovação" : "sem aprovação"}</span></li>
          </ul>
        ) : <p className={`${emptyTw} mt-3`}>A política padrão será registrada quando a escola salvar as regras na Gestão escolar.</p>}
      </details>

      <p className={noteTw}>Esta visão é somente leitura. Ela não cobra, não envia mensagem, não cancela matrícula e não confirma pagamento.</p>
    </section>
  );
}
