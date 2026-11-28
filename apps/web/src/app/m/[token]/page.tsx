"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Link2,
  Music2,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { StateBadge, money, schoolTw, weekdayLabel } from "../../school-ui";

type PublicForm = {
  tenantName: string;
  tenantSlug: string;
  ownerName: string;
  welcomeMessage: string;
  course: {
    id: string; name: string; imageUrl?: string | null; summary?: string | null;
    level?: string | null; durationLabel?: string | null; tuitionAmountCents?: number | null;
  } | null;
  lesson: {
    teacherId: string | null; teacherName: string; weekday: number | null; startTime: string | null;
    durationMinutes: number | null; period: string | null; contractPeriod: string | null;
    contractedSessions: number | null;
  };
  templateStatus: { contract: boolean; enrollmentForm: boolean };
  prefilled: Record<string, string>;
};

type SubmitResult = {
  submissionId: string;
  status: string;
  signingUrl: string | null;
  signed: boolean;
  generated: boolean;
  sent: boolean;
  message: string;
};

const initial = {
  studentName: "", studentCpf: "", studentEmail: "", studentPhone: "",
  guardianName: "", guardianRelationship: "", guardianPhone: "", guardianEmail: "",
  addressLine: "", instrument: "", level: "", startDate: "", startTime: "",
  weekday: "", durationMinutes: "", contractPeriod: "", contractedSessions: "",
  paymentMethod: "", observations: "", billingMode: "", website: "",
};

const digits = (value: string) => value.replace(/\D/g, "");
const maskCpf = (value: string) => {
  const valueDigits = digits(value).slice(0, 11);
  return valueDigits.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};
const maskPhone = (value: string) => {
  const valueDigits = digits(value).slice(0, 11);
  if (valueDigits.length <= 10) return valueDigits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return valueDigits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/^(\d{2})\s(\d{5})(\d)/, "$1 $2-$3");
};
const periodLabel = (value?: string | null) => ({ MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite" } as Record<string, string>)[value || ""] || "";
const contractLabel = (value?: string | null) => ({ MONTHLY: "Mensal", QUARTERLY: "Trimestral", SEMESTER: "Semestral", YEARLY: "Anual" } as Record<string, string>)[value || ""] || "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, {
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body?.message || "Não foi possível concluir esta etapa.");
  return body;
}

export default function SchoolEnrollmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicForm | null>(null);
  const [form, setForm] = useState({ ...initial });
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void api<PublicForm>(`school-enrollments/public/${encodeURIComponent(token)}`)
      .then((value) => { if (live) { setData(value); setForm((current) => ({
        ...current,
        level: value.course?.level || "",
        startTime: value.lesson?.startTime || "",
        weekday: value.lesson?.weekday ? String(value.lesson.weekday) : "",
        durationMinutes: value.lesson?.durationMinutes ? String(value.lesson.durationMinutes) : "",
        contractPeriod: value.lesson?.contractPeriod || "",
        contractedSessions: value.lesson?.contractedSessions ? String(value.lesson.contractedSessions) : "",
        ...value.prefilled,
      })); } })
      .catch((loadError) => { if (live) setError(loadError instanceof Error ? loadError.message : "Link de matrícula indisponível."); });
    return () => { live = false; };
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api<SubmitResult>(`school-enrollments/public/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setResult(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar seus dados.");
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-3xl gap-4 bg-zinc-100 px-4 py-5 sm:px-6 sm:py-10">
      <header className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-token-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-11 place-items-center rounded-xl bg-amber-100 text-amber-600" aria-hidden="true"><GraduationCap size={22} /></span>
          <div className="grid min-w-0">
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-widest text-amber-600">{data?.tenantName || "Escola"} · Matrícula</p>
            <p className="m-0 text-xs text-slate-600">Formulário seguro enviado por {data?.ownerName || "sua escola"}</p>
          </div>
        </div>
        {data ? <p className="m-0 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-700">{data.welcomeMessage}</p> : null}
      </header>

      {error ? <p role="status" className="rounded-xl border border-red-100 bg-red-100 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {!data && !error ? <p role="status" className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm text-slate-600">Abrindo formulário de matrícula…</p> : null}

      {result ? (
        <section className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-token-sm" data-testid="enrollment-result">
          <div className="grid place-items-center gap-2 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600" aria-hidden="true"><CheckCircle2 size={28} /></span>
            <h1 className="m-0 text-xl font-extrabold text-slate-950">Dados recebidos pela escola</h1>
            <p className="m-0 max-w-lg text-sm leading-relaxed text-slate-600">{result.message}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <StateBadge state={result.status} />
            <span className={schoolTw.chip}>{result.signed ? "Assinatura confirmada" : "Assinatura pendente"}</span>
            <span className={schoolTw.chip}>{result.generated ? "Documentos gerados" : "Documentos ainda não gerados"}</span>
            <span className={schoolTw.chip}>{result.sent ? "Envio confirmado" : "Envio não confirmado"}</span>
          </div>
          {result.signingUrl ? (
            <a className={schoolTw.buttonPrimary} href={result.signingUrl} target="_blank" rel="noreferrer" data-testid="enrollment-signing-url">
              <FileText size={18} aria-hidden="true" /> Assinar contrato no Documenso
            </a>
          ) : (
            <p className={schoolTw.note}><AlertTriangle size={14} aria-hidden="true" /> O link de assinatura será disponibilizado assim que a escola configurar o contrato e o Documenso.</p>
          )}
          <p className={schoolTw.note}>Protocolo: {result.submissionId}. Contrato e ficha só são gerados após confirmação da assinatura. Nenhum envio é afirmado sem confirmação do provedor.</p>
        </section>
      ) : null}

      {data && !result ? (
        <form className="grid gap-4" onSubmit={(event) => void submit(event)} data-testid="public-enrollment-form">
          <section className={`${schoolTw.card} sm:p-5`}>
            <div className="grid h-40 place-items-center overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-amber-100 via-blue-50 to-slate-100">
              {data.course?.imageUrl ? (
                <img src={data.course.imageUrl} alt={`Foto do curso ${data.course.name}`} className="size-full object-cover" />
              ) : <Music2 size={44} aria-hidden="true" className="text-amber-600" />}
            </div>
            <div className="grid gap-1">
              <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-950">{data.course?.name || "Matrícula escolar"}</h1>
              <p className="m-0 text-sm leading-relaxed text-slate-600">{data.course?.summary || "Preencha seus dados para receber o contrato e a ficha de matrícula."}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.course?.level ? <span className={schoolTw.chip}><Sparkles size={13} aria-hidden="true" /> {data.course.level}</span> : null}
              {data.course?.durationLabel ? <span className={schoolTw.chip}><Clock3 size={13} aria-hidden="true" /> {data.course.durationLabel}</span> : null}
              {data.lesson?.weekday || data.lesson?.startTime ? <span className={schoolTw.chip}><CalendarDays size={13} aria-hidden="true" /> {data.lesson.weekday ? weekdayLabel(data.lesson.weekday) : "Dia a definir"}{data.lesson.startTime ? ` · ${data.lesson.startTime}` : ""}</span> : null}
              {data.lesson?.period ? <span className={schoolTw.chip}><Clock3 size={13} aria-hidden="true" /> {periodLabel(data.lesson.period)}</span> : null}
              {data.lesson?.durationMinutes ? <span className={schoolTw.chip}>{data.lesson.durationMinutes} min</span> : null}
              {data.course?.tuitionAmountCents != null ? <span className={schoolTw.chip}><Wallet size={13} aria-hidden="true" /> {money(data.course.tuitionAmountCents)}</span> : null}
            </div>
          </section>

          <section className={`${schoolTw.card} sm:p-5`}>
            <h2 className={schoolTw.sectionTitle}><ShieldCheck size={18} aria-hidden="true" /> Seus dados</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={schoolTw.label}>Nome completo<input className={schoolTw.input} autoComplete="name" required value={form.studentName} onChange={(event) => set("studentName", event.target.value)} /></label>
              <label className={schoolTw.label}>CPF<input className={schoolTw.input} inputMode="numeric" required value={form.studentCpf} onChange={(event) => set("studentCpf", maskCpf(event.target.value))} /></label>
              <label className={schoolTw.label}>E-mail<input className={schoolTw.input} type="email" autoComplete="email" value={form.studentEmail} onChange={(event) => set("studentEmail", event.target.value)} /></label>
              <label className={schoolTw.label}>WhatsApp<input className={schoolTw.input} type="tel" inputMode="tel" required value={form.studentPhone} onChange={(event) => set("studentPhone", maskPhone(event.target.value))} /></label>
            </div>
          </section>

          <details className={`${schoolTw.card} sm:p-5`} data-testid="public-guardian-section">
            <summary className="cursor-pointer text-sm font-extrabold text-slate-950">Responsável e cliente (opcional)</summary>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={schoolTw.label}>Quem será o cliente no Asaas?
                <select className={schoolTw.select} value={form.billingMode} onChange={(event) => set("billingMode", event.target.value)}>
                  <option value="">Selecione se houver responsável</option>
                  <option value="STUDENT">O aluno</option>
                  <option value="GUARDIAN">O responsável</option>
                </select>
              </label>
              <label className={schoolTw.label}>Nome do responsável<input className={schoolTw.input} value={form.guardianName} onChange={(event) => set("guardianName", event.target.value)} /></label>
              <label className={schoolTw.label}>Parentesco
                <select className={schoolTw.select} value={form.guardianRelationship} onChange={(event) => set("guardianRelationship", event.target.value)}>
                  <option value="">Selecione</option>
                  <option value="MAE">Mãe</option>
                  <option value="PAI">Pai</option>
                  <option value="RESPONSAVEL">Responsável</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>
              <label className={schoolTw.label}>WhatsApp do responsável<input className={schoolTw.input} type="tel" inputMode="tel" value={form.guardianPhone} onChange={(event) => set("guardianPhone", maskPhone(event.target.value))} /></label>
              <label className={schoolTw.label}>E-mail do responsável<input className={schoolTw.input} type="email" value={form.guardianEmail} onChange={(event) => set("guardianEmail", event.target.value)} /></label>
              <label className={schoolTw.label}>Endereço<input className={schoolTw.input} value={form.addressLine} onChange={(event) => set("addressLine", event.target.value)} /></label>
            </div>
          </details>

          <details className={`${schoolTw.card} sm:p-5`} data-testid="public-class-section">
            <summary className="cursor-pointer text-sm font-extrabold text-slate-950">Matéria, horário e pagamento</summary>
            <p className={schoolTw.note}>
              Professor: {data.lesson?.teacherName || data.ownerName}. Período: {periodLabel(data.lesson?.period) || "a definir"}.
              {data.lesson?.contractPeriod ? ` ${contractLabel(data.lesson.contractPeriod)} · ${data.lesson.contractedSessions ?? "—"} aula(s) contratada(s).` : ""}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={schoolTw.label}>Instrumento<input className={schoolTw.input} value={form.instrument} onChange={(event) => set("instrument", event.target.value)} /></label>
              <label className={schoolTw.label}>Nível<input className={schoolTw.input} value={form.level} onChange={(event) => set("level", event.target.value)} /></label>
              <label className={schoolTw.label}>Data de início<input className={schoolTw.input} type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} /></label>
              <label className={schoolTw.label}>Dia da semana
                <select className={schoolTw.select} value={form.weekday} onChange={(event) => set("weekday", event.target.value)}>
                  <option value="">Selecione</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{weekdayLabel(day)}</option>)}
                </select>
              </label>
              <label className={schoolTw.label}>Horário<input className={schoolTw.input} type="time" value={form.startTime} onChange={(event) => set("startTime", event.target.value)} /></label>
              <label className={schoolTw.label}>Forma de pagamento
                <select className={schoolTw.select} value={form.paymentMethod} onChange={(event) => set("paymentMethod", event.target.value)}>
                  <option value="">Selecione</option>
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="TRANSFER">Transferência</option>
                </select>
              </label>
              <label className={schoolTw.label}>Observações<textarea className={schoolTw.textarea} rows={3} value={form.observations} onChange={(event) => set("observations", event.target.value)} /></label>
            </div>
          </details>

          <label aria-hidden="true" className="hidden">
            Deixe este campo em branco
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set("website", event.target.value)} />
          </label>

          <div className={schoolTw.card}>
            <div className={schoolTw.tileGrid} aria-label="Etapas da matrícula">
              <div className={schoolTw.tile}><span className={schoolTw.tileIcon}><FileText size={22} /></span><span className={schoolTw.tileLabel}>Contrato</span></div>
              <div className={schoolTw.tile}><span className={schoolTw.tileIcon}><Link2 size={22} /></span><span className={schoolTw.tileLabel}>Assinatura</span></div>
              <div className={schoolTw.tile}><span className={schoolTw.tileIcon}><Send size={22} /></span><span className={schoolTw.tileLabel}>Boas-vindas</span></div>
              <div className={schoolTw.tile}><span className={schoolTw.tileIcon}><CheckCircle2 size={22} /></span><span className={schoolTw.tileLabel}>Envio</span></div>
            </div>
            <p className={schoolTw.note}>Contrato: {data.templateStatus.contract ? "modelo configurado" : "modelo pendente"} · Ficha: {data.templateStatus.enrollmentForm ? "modelo configurado" : "modelo pendente"}. Nenhum documento é gerado antes da assinatura confirmada.</p>
          </div>

          <button type="submit" className={`${schoolTw.buttonPrimary} min-h-16 w-full`} disabled={busy} data-testid="public-enrollment-submit">
            <Send size={19} aria-hidden="true" /> {busy ? "Enviando…" : "Enviar dados e seguir para assinatura"}
          </button>
        </form>
      ) : null}

      <footer className="pb-6 text-center text-xs text-slate-600">
        Formulário da {data?.tenantName || "escola"} · assinatura digital via Documenso · sem dados pessoais pré-preenchidos.
      </footer>
    </main>
  );
}
