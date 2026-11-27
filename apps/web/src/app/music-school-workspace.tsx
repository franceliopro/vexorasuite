"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { GraduationCap, CalendarDays, UsersRound, ClipboardCheck, Wallet } from "lucide-react";

type Named = { id: string; name: string };
type ClassRow = Named & {
  instrument: string | null;
  departmentName: string | null;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  active: boolean;
  studentCount: number;
  pendingMakeups: number;
};
type BalanceRow = {
  enrollmentId: string;
  classId: string;
  className: string;
  contactId: string;
  contactName: string | null;
  contracted: number;
  consumed: number;
  balance: number;
  pendingMakeups: number;
  billing: { status: string; nextDueDate: string | null; amountCents: number | null; executed: boolean; confirmed: boolean };
};
type AttendanceRow = {
  id: string;
  sessionDate: string;
  outcome: string;
  note: string | null;
  enrollment: { contactId: string; classId: string };
};
type Options = { departments: Named[]; contacts: Named[] };
type Snapshot = { classes: ClassRow[]; balances: BalanceRow[]; attendances: AttendanceRow[]; options: Options };

const DAYS = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const OUTCOMES: Record<string, string> = {
  ATTENDED: "Aluno presente",
  STUDENT_ABSENT: "Aluno ausente",
  TEACHER_ABSENT: "Professor ausente",
  CANCELLED: "Cancelada",
  MAKEUP: "Reposição",
};
const BILLING: Record<string, string> = {
  SCHEDULED: "Cobrança agendada — não enviada",
  SENT: "Enviada — aguardando evidência",
  CONFIRMED: "Confirmada no provedor",
  FAILED: "Falha registrada",
};

const shellTw = "mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-4 py-6 sm:px-6";
const headerTw = "flex flex-wrap items-start gap-4 rounded-token-sm border border-line bg-surface p-5 shadow-token-sm";
const heroIconTw = "size-10 shrink-0 text-blue-600";
const titleTw = "m-0 font-display text-2xl font-extrabold text-ink";
const copyTw = "mb-0 mt-1 max-w-3xl text-body text-ink-secondary";
const badgeTw = "rounded-token-sm border border-line px-2.5 py-1 text-xs font-bold text-ink-secondary";
const gridTw = "grid gap-4 lg:grid-cols-3";
const cardTw = "flex min-w-0 flex-col gap-3 rounded-token-sm border border-line bg-surface p-4 shadow-token-sm";
const cardTitleTw = "m-0 flex items-center gap-2 text-base font-bold text-ink";
const rowTw = "rounded-token-sm border border-line px-3 py-2.5";
const summaryTw = "flex cursor-pointer flex-wrap items-center justify-between gap-2 text-body font-semibold text-ink";
const mutedTw = "text-xs text-ink-secondary";
const fieldTw = "min-h-control w-full rounded-token-sm border border-line bg-surface px-3 text-body text-ink";
const labelTw = "flex flex-col gap-1 text-xs font-bold text-ink-secondary";
const buttonTw = "inline-flex min-h-control items-center justify-center rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const detailsTw = "rounded-token-sm border border-line bg-surface px-4 py-3 shadow-token-sm";
const summaryFormTw = "cursor-pointer text-body font-bold text-ink";
const formTw = "mt-3 grid gap-3 sm:grid-cols-2";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload as T;
}

const messageOf = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

/** Escola de Música — operação do tenant autenticado. Nenhuma mensagem é enviada por aqui. */
export function MusicSchoolWorkspace() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", instrument: "", departmentId: "", weekday: "1", startTime: "18:00", durationMinutes: "60" });
  const [enrollForm, setEnrollForm] = useState({ classId: "", contactId: "", contractedSessions: "8", purchasedSessions: "0", billingAmountCents: "", billingNextDueDate: "" });
  const [attendanceForm, setAttendanceForm] = useState({ enrollmentId: "", sessionDate: new Date().toISOString().slice(0, 10), outcome: "ATTENDED", note: "" });

  const load = useCallback(async () => {
    setError("");
    try {
      const [classes, balances, attendances, options] = await Promise.all([
        api<ClassRow[]>("music-school/classes"),
        api<BalanceRow[]>("music-school/balances"),
        api<AttendanceRow[]>("music-school/attendances"),
        api<Options>("music-school/options"),
      ]);
      setSnapshot({ classes, balances, attendances, options });
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>, path: string, body: Record<string, unknown>, done: string) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setNotice(done);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const classes = snapshot?.classes ?? [];
  const balances = snapshot?.balances ?? [];
  const attendances = snapshot?.attendances ?? [];
  const departments = snapshot?.options.departments ?? [];
  const contacts = snapshot?.options.contacts ?? [];

  return (
    <section className={shellTw} aria-label="Escola de Música">
      <header className={headerTw}>
        <GraduationCap size={40} className={heroIconTw} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className={titleTw}>Escola de Música</h1>
          <p className={copyTw}>Turmas com professor do CRM, alunos como contatos, presença e saldo de aulas calculados no servidor.</p>
        </div>
        <span className={badgeTw}>Cobrança apenas agendada — nenhum envio executado</span>
      </header>

      {error ? <p role="status" className="text-body text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="text-body text-green-700">{notice}</p> : null}

      <div className={gridTw}>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><CalendarDays size={18} aria-hidden="true" /> Turmas</h2>
          {classes.length === 0 ? <p className={mutedTw}>Nenhuma turma cadastrada nesta empresa.</p> : null}
          {classes.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}>
                <span>{item.name}</span>
                <span className={mutedTw}>{DAYS[item.weekday] || item.weekday} · {item.startTime} · {item.studentCount} aluno(s)</span>
              </summary>
              <p className={mutedTw}>Professor: {item.departmentName || "—"} · Instrumento: {item.instrument || "—"}</p>
              <p className={mutedTw}>Duração: {item.durationMinutes} min · Reposições pendentes: {item.pendingMakeups}</p>
            </details>
          ))}
        </article>

        <article className={cardTw}>
          <h2 className={cardTitleTw}><UsersRound size={18} aria-hidden="true" /> Alunos e saldos</h2>
          {balances.length === 0 ? <p className={mutedTw}>Nenhum aluno matriculado nesta empresa.</p> : null}
          {balances.map((item) => (
            <details key={item.enrollmentId} className={rowTw}>
              <summary className={summaryTw}>
                <span>{item.contactName || "Aluno"}</span>
                <span className={mutedTw}>{item.balance} aula(s) disponível(is)</span>
              </summary>
              <p className={mutedTw}>{item.className} · Contratadas: {item.contracted} · Consumidas: {item.consumed}</p>
              <p className={mutedTw}>Reposições pendentes: {item.pendingMakeups} · {BILLING[item.billing.status] || item.billing.status}</p>
            </details>
          ))}
        </article>

        <article className={cardTw}>
          <h2 className={cardTitleTw}><ClipboardCheck size={18} aria-hidden="true" /> Presença recente</h2>
          {attendances.length === 0 ? <p className={mutedTw}>Nenhuma presença registrada nesta empresa.</p> : null}
          {attendances.slice(0, 12).map((item) => (
            <div key={item.id} className={rowTw}>
              <p className="m-0 text-body font-semibold text-ink">{OUTCOMES[item.outcome] || item.outcome}</p>
              <p className={mutedTw}>{item.sessionDate}{item.note ? ` · ${item.note}` : ""}</p>
            </div>
          ))}
        </article>
      </div>

      <div className={gridTw}>
        <details className={detailsTw} data-testid="music-school-class-form">
          <summary className={summaryFormTw}>Nova turma</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "music-school/classes", {
            ...classForm,
            durationMinutes: Number(classForm.durationMinutes),
            weekday: Number(classForm.weekday),
          }, "Turma cadastrada.")}>
            <label className={labelTw}>Nome<input className={fieldTw} required value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} /></label>
            <label className={labelTw}>Instrumento<input className={fieldTw} value={classForm.instrument} onChange={(event) => setClassForm({ ...classForm, instrument: event.target.value })} /></label>
            <label className={labelTw}>Professor (departamento)<select className={fieldTw} required value={classForm.departmentId} onChange={(event) => setClassForm({ ...classForm, departmentId: event.target.value })}><option value="">Selecione</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Dia da semana<select className={fieldTw} value={classForm.weekday} onChange={(event) => setClassForm({ ...classForm, weekday: event.target.value })}>{DAYS.slice(1).map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
            <label className={labelTw}>Horário<input className={fieldTw} type="time" required value={classForm.startTime} onChange={(event) => setClassForm({ ...classForm, startTime: event.target.value })} /></label>
            <label className={labelTw}>Duração (minutos)<input className={fieldTw} type="number" min={30} max={180} step={30} value={classForm.durationMinutes} onChange={(event) => setClassForm({ ...classForm, durationMinutes: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar turma</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="music-school-enroll-form">
          <summary className={summaryFormTw}>Matricular aluno</summary>
          <form className={formTw} onSubmit={(event) => {
            if (!enrollForm.classId) { setError("Selecione uma turma."); event.preventDefault(); return; }
            void submit(event, `music-school/classes/${enrollForm.classId}/enrollments`, {
              contactId: enrollForm.contactId,
              contractedSessions: Number(enrollForm.contractedSessions),
              purchasedSessions: Number(enrollForm.purchasedSessions),
              ...(enrollForm.billingAmountCents ? { billingAmountCents: Number(enrollForm.billingAmountCents), billingNextDueDate: enrollForm.billingNextDueDate } : {}),
            }, "Matrícula registrada. Cobrança agendada, sem envio.");
          }}>
            <label className={labelTw}>Turma<select className={fieldTw} required value={enrollForm.classId} onChange={(event) => setEnrollForm({ ...enrollForm, classId: event.target.value })}><option value="">Selecione</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Aluno (CRM)<select className={fieldTw} required value={enrollForm.contactId} onChange={(event) => setEnrollForm({ ...enrollForm, contactId: event.target.value })}><option value="">Selecione</option>{contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Aulas contratadas<input className={fieldTw} type="number" min={1} max={1000} value={enrollForm.contractedSessions} onChange={(event) => setEnrollForm({ ...enrollForm, contractedSessions: event.target.value })} /></label>
            <label className={labelTw}>Aulas adicionais<input className={fieldTw} type="number" min={0} max={1000} value={enrollForm.purchasedSessions} onChange={(event) => setEnrollForm({ ...enrollForm, purchasedSessions: event.target.value })} /></label>
            <label className={labelTw}>Valor mensal (centavos, opcional)<input className={fieldTw} type="number" min={0} value={enrollForm.billingAmountCents} onChange={(event) => setEnrollForm({ ...enrollForm, billingAmountCents: event.target.value })} /></label>
            <label className={labelTw}>Primeiro vencimento (se houver valor)<input className={fieldTw} type="date" value={enrollForm.billingNextDueDate} onChange={(event) => setEnrollForm({ ...enrollForm, billingNextDueDate: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Matricular</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="music-school-attendance-form">
          <summary className={summaryFormTw}>Registrar presença</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "music-school/attendances", {
            ...attendanceForm,
          }, "Presença registrada e saldo recalculado.")}>
            <label className={labelTw}>Matrícula<select className={fieldTw} required value={attendanceForm.enrollmentId} onChange={(event) => setAttendanceForm({ ...attendanceForm, enrollmentId: event.target.value })}><option value="">Selecione</option>{balances.map((item) => <option key={item.enrollmentId} value={item.enrollmentId}>{item.contactName || "Aluno"} — {item.className}</option>)}</select></label>
            <label className={labelTw}>Data da aula<input className={fieldTw} type="date" required value={attendanceForm.sessionDate} onChange={(event) => setAttendanceForm({ ...attendanceForm, sessionDate: event.target.value })} /></label>
            <label className={labelTw}>Resultado<select className={fieldTw} value={attendanceForm.outcome} onChange={(event) => setAttendanceForm({ ...attendanceForm, outcome: event.target.value })}>{Object.entries(OUTCOMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={labelTw}>Observação (opcional)<input className={fieldTw} value={attendanceForm.note} onChange={(event) => setAttendanceForm({ ...attendanceForm, note: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Registrar</button>
          </form>
        </details>
      </div>

      <p className={mutedTw}><Wallet size={13} aria-hidden="true" /> A cobrança recorrente é apenas agendada. Pagamento, envio e confirmação dependem de evidência do Financeiro/provedor.</p>
    </section>
  );
}
