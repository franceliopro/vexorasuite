"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  Link2,
  Music2,
  RefreshCw,
  Search,
  Send,
  UsersRound,
  Wallet,
} from "lucide-react";
import { SchoolEnrollmentsWorkspace } from "./school-enrollments-workspace";
import {
  ActionTile,
  BarChart,
  CourseCard,
  MetricTile,
  QuickAction,
  SchoolSheet,
  dateLabel,
  money,
  schoolTw,
  type Course,
} from "./school-ui";

type Tab = "home" | "lesson" | "history" | "finance" | "enrollments";
type Sheet = "course" | "payment" | null;

type Person = { id: string; kind: "STUDENT" | "TEACHER"; name: string; active: boolean };
type ClassRow = { id: string; courseId: string; teacherId: string; name: string; weekday: number; startTime: string; durationMinutes: number; active: boolean };
type Enrollment = { id: string; classId: string; studentId: string; contractedSessions: number; purchasedSessions: number; status: string };
type SessionRow = { id: string; classId: string; sessionDate: string; status: string; summaryHtml?: string | null };
type Attendance = { id: string; sessionId: string; personId: string; personKind: string; status: string; note: string | null };
type LessonPlan = { id: string; classId: string; title: string; contentHtml?: string | null; version: number; createdAt: string | null };
type Balance = {
  enrollmentId: string; classId: string; studentId: string;
  contracted: number; consumed: number; balance: number; pendingMakeups: number;
  paidCents?: number; contractTotalCents?: number | null; overdueInstallments?: number;
  tuition: { status: string; amountCents: number | null; nextDueDate: string | null };
};
type Snapshot = {
  courses: Course[]; defaultCourses?: Course[]; people: Person[]; classes: ClassRow[]; enrollments: Enrollment[];
  sessions: SessionRow[]; attendances: Attendance[]; lessonPlans: LessonPlan[]; balances: Balance[];
  warnings?: string[];
};
type SeedResult = { created: number; total: number };

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Presente",
  ABSENT: "Falta",
  JUSTIFIED: "Justificada",
  MAKEUP: "Reposição",
  CANCELLED: "Cancelada",
};
const ATTENDANCE_STATES = ["PRESENT", "ABSENT", "JUSTIFIED", "MAKEUP", "CANCELLED"] as const;

const today = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
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

const nameOf = (people: Person[], id?: string | null) => people.find((person) => person.id === id)?.name || "—";
const shortName = (value: string) => value.trim().split(/\s+/)[0] || value;

export function SchoolExperience({ userName = "" }: { userName?: string }) {
  const [tab, setTab] = useState<Tab>("home");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [payment, setPayment] = useState({ enrollmentId: "", amountCents: "", paidAt: today(), source: "CASH", externalReference: "" });
  const [form, setForm] = useState({
    studentId: "", teacherId: "", courseId: "", sessionId: "new",
    sessionDate: today(), title: "", content: "", studentStatus: "PRESENT" as typeof ATTENDANCE_STATES[number],
    teacherStatus: "PRESENT" as typeof ATTENDANCE_STATES[number], note: "",
  });

  const load = useCallback(async (seedDefaults = true) => {
    try {
      const data = await api<Snapshot>("school/snapshot");
      const existing = new Set((data.courses || []).map((course) => course.name));
      const defaults = data.defaultCourses || [];
      if (seedDefaults && defaults.some((course) => !existing.has(course.name))) {
        const seeded = await api<SeedResult>("school/seed-default-courses", { method: "POST" });
        setNotice(`${seeded.created} cursos padrão adicionados ao catálogo desta empresa.`);
        await load(false);
        return;
      }
      setSnapshot(data);
      setForm((current) => {
        if (current.teacherId) return current;
        const rows = data.people || [];
        const teachers = rows.filter((person) => person.kind === "TEACHER" && person.active !== false);
        const preferred = teachers.find((person) => person.name.toLowerCase() === userName.trim().toLowerCase()) || teachers[0];
        return { ...current, teacherId: preferred?.id || "" };
      });
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os dados da escola.");
    }
  }, [userName]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onTab = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (navigation.some((item) => item.id === id)) {
        setTab(id as Tab);
        setSheet(null);
      }
    };
    window.addEventListener("vexora:school-tab", onTab);
    return () => window.removeEventListener("vexora:school-tab", onTab);
  }, []);

  const people = snapshot?.people || [];
  const courses = snapshot?.courses || [];
  const classes = snapshot?.classes || [];
  const sessions = snapshot?.sessions || [];
  const attendances = snapshot?.attendances || [];
  const enrollments = snapshot?.enrollments || [];
  const balances = snapshot?.balances || [];
  const lessonPlans = snapshot?.lessonPlans || [];
  const students = people.filter((person) => person.kind === "STUDENT" && person.active !== false);
  const teachers = people.filter((person) => person.kind === "TEACHER" && person.active !== false);
  const courseOf = (id?: string | null) => courses.find((course) => course.id === id) || null;

  /** O servidor cria o vínculo individual aluno/curso/professor. Aqui só localizamos o registro para exibição. */
  const individualClassFor = (studentId: string, courseId: string, teacherId: string) => {
    const student = people.find((person) => person.id === studentId);
    const course = courseOf(courseId);
    if (!student || !course) return null;
    const name = `${student.name} · ${course.name}`;
    return classes.find((item) => item.courseId === courseId && item.teacherId === teacherId && item.name === name)
      || classes.find((item) => item.courseId === courseId && item.teacherId === teacherId)
      || null;
  };
  const classLabel = (classId?: string | null) => {
    const row = classes.find((item) => item.id === classId);
    if (!row) return "—";
    const studentId = enrollments.find((item) => item.classId === row.id)?.studentId;
    return `${nameOf(people, studentId)} · ${courseOf(row.courseId)?.name || "Curso"}`;
  };
  const selectedClass = individualClassFor(form.studentId, form.courseId, form.teacherId);
  const classSessions = sessions.filter((item) => item.classId === selectedClass?.id);
  const selectedEnrollment = enrollments.find((item) => item.classId === selectedClass?.id && item.studentId === form.studentId) || null;
  const selectedBalance = balances.find((item) => item.enrollmentId === selectedEnrollment?.id) || null;

  const remaining = balances.reduce((sum, item) => sum + Math.max(0, Number(item.balance || 0)), 0);
  const absences = attendances.filter((item) => item.personKind === "STUDENT" && ["ABSENT", "JUSTIFIED"].includes(item.status)).length;
  const heldLessons = sessions.filter((item) => item.status === "HELD").length;
  const overdue = balances.filter((item) => Number(item.overdueInstallments || 0) > 0).length;
  const paidCents = balances.reduce((sum, item) => sum + Number(item.paidCents || 0), 0);
  const contractCents = balances.reduce((sum, item) => sum + Number(item.contractTotalCents || 0), 0);
  const presenceCount = attendances.filter((item) => item.personKind === "STUDENT" && item.status === "PRESENT").length;
  const makeupCount = attendances.filter((item) => item.status === "MAKEUP").length;

  const classChart = classes.slice(0, 6).map((item) => ({
    caption: shortName(classLabel(item.id)),
    value: sessions.filter((session) => session.classId === item.id && session.status === "HELD").length,
  }));
  const financeChart = students.slice(0, 6).map((student) => ({
    caption: shortName(student.name),
    value: Math.round(balances
      .filter((item) => item.studentId === student.id)
      .reduce((sum, item) => sum + Number(item.paidCents || 0), 0) / 100),
  }));

  const catalog = courses.filter((course) => course.name.toLowerCase().includes(query.trim().toLowerCase()));

  const submitLesson = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      let sessionId = form.sessionId;
      if (!sessionId || sessionId === "new") {
        const created = await api<{ id: string }>("school/records", {
          method: "POST",
          body: JSON.stringify({
            kind: "SESSION", studentId: form.studentId, courseId: form.courseId, teacherId: form.teacherId,
            sessionDate: form.sessionDate, status: "HELD",
          }),
        });
        sessionId = created.id;
      }
      await api("school/records", {
        method: "POST",
        body: JSON.stringify({
          kind: "LESSON_PLAN", studentId: form.studentId, courseId: form.courseId, teacherId: form.teacherId, title: form.title,
          objectiveHtml: "", contentHtml: form.content, activitiesHtml: "", observationsHtml: "", materials: [],
        }),
      });
      await api("school/attendances", {
        method: "POST",
        body: JSON.stringify({
          paired: true, sessionId, studentId: form.studentId, courseId: form.courseId, teacherId: form.teacherId,
          studentStatus: form.studentStatus, teacherStatus: form.teacherStatus, note: form.note,
        }),
      });
      setNotice("Aula registrada: título, conteúdo e presença de aluno e professor salvos.");
      setForm((current) => ({ ...current, sessionId, title: "", content: "", note: "" }));
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar a aula.");
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("school/records", {
        method: "POST",
        body: JSON.stringify({
          kind: "PAYMENT_RECEIPT", enrollmentId: payment.enrollmentId,
          amountCents: Number(payment.amountCents), paidAt: payment.paidAt,
          source: payment.source, externalReference: payment.externalReference,
        }),
      });
      setNotice("Recebimento registrado. Nenhuma cobrança automática foi enviada.");
      setSheet(null);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível registrar o recebimento.");
    } finally {
      setBusy(false);
    }
  };

  const markOverdue = async (enrollmentId: string) => {
    setBusy(true);
    setError("");
    try {
      await api("school/records", {
        method: "POST", body: JSON.stringify({ kind: "MARK_OVERDUE", enrollmentId }),
      });
      setNotice("Atraso marcado. Nenhuma mensagem foi enviada.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível marcar o atraso.");
    } finally {
      setBusy(false);
    }
  };

  const openPayment = (enrollmentId: string) => {
    setPayment({ enrollmentId, amountCents: "", paidAt: today(), source: "CASH", externalReference: "" });
    setSheet("payment");
  };

  const navigation: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: "home", label: "Início", icon: LayoutDashboard },
    { id: "lesson", label: "Aula", icon: BookOpen },
    { id: "history", label: "Aulas", icon: CalendarDays },
    { id: "finance", label: "Financeiro", icon: Wallet },
    { id: "enrollments", label: "Matrículas", icon: Link2 },
  ];

  return (
    <section className={schoolTw.shell} aria-label="Sistema escolar móvel">
      {error ? <p role="status" className="rounded-xl border border-red-100 bg-red-100 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-600">{notice}</p> : null}
      {(snapshot?.warnings || [])
        .filter((warning) => !/^Resumos indispon[íi]vel(es)? nesta instala[çc][ãa]o\.?$/i.test(warning))
        .map((warning) => (
          <p key={warning} role="status" className="rounded-xl border border-amber-100 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-700">{warning}</p>
        ))}

      {tab === "home" ? (
        <>
          <div className={schoolTw.hero}>
            <div>
              <h2 className={schoolTw.heroTitle}>Olá, {shortName(userName || "professor")} 👋</h2>
            </div>
            <button type="button" className={schoolTw.buttonSoft} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true" /> Atualizar</button>
          </div>

          <div className={schoolTw.section}>
            <div className={schoolTw.sectionHead}>
              <h3 className={schoolTw.sectionTitle}><ClipboardCheck size={18} aria-hidden="true" /> Atalhos</h3>
              <p className={schoolTw.sectionHint}>Botões grandes, um toque só — o mesmo padrão no celular e no desktop.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ActionTile icon={<BookOpen size={28} />} label="Registrar aula" onClick={() => setTab("lesson")} testId="school-tile-lesson" />
              <ActionTile icon={<CalendarDays size={28} />} label="Aulas e faltas" onClick={() => setTab("history")} testId="school-tile-history" />
              <ActionTile icon={<Wallet size={28} />} label="Financeiro" onClick={() => setTab("finance")} testId="school-tile-finance" />
              <ActionTile icon={<Link2 size={28} />} label="Matrículas" onClick={() => setTab("enrollments")} testId="school-tile-enrollments" />
            </div>
          </div>

          <div className={schoolTw.metricGrid}>
            <MetricTile icon={<ClipboardCheck size={20} />} label="Aulas restantes" value={remaining} hint="Saldo somado dos contratos" testId="metric-remaining" tone="amber" />
            <MetricTile icon={<AlertTriangle size={20} />} label="Faltas" value={absences} hint="Ausências e justificadas" testId="metric-absences" tone="red" />
            <MetricTile icon={<GraduationCap size={20} />} label="Aulas ministradas" value={heldLessons} hint="Sessões realizadas" testId="metric-held" tone="green" />
            <MetricTile icon={<Wallet size={20} />} label="Mensalidades em atraso" value={overdue} hint="Matrículas com parcelas vencidas" testId="metric-overdue" tone="blue" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <BarChart title="Aulas realizadas por aluno" values={classChart.map((item) => item.value)} captions={classChart.map((item) => item.caption)} testId="school-chart-classes" />
            <BarChart title="Presença e reposição" values={[presenceCount, absences, makeupCount]} captions={["Presentes", "Faltas", "Reposições"]} testId="school-chart-attendance" />
          </div>

          <div className={schoolTw.section}>
            <div className={schoolTw.sectionHead}>
              <h3 className={schoolTw.sectionTitle}><Music2 size={18} aria-hidden="true" /> Catálogo de cursos</h3>
              <label className="relative w-full max-w-xs">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${schoolTw.input} pl-9`} placeholder="Buscar curso" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar curso" />
              </label>
            </div>
            {catalog.length === 0 ? <p className={schoolTw.empty}>Nenhum curso encontrado. Cadastre cursos em Gestão escolar.</p> : (
              <div className={schoolTw.grid}>
                {catalog.map((course) => {
                  const courseStudents = enrollments.filter((item) => classes.some((row) => row.id === item.classId && row.courseId === course.id));
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      classInfo={courseStudents.length ? `${courseStudents.length} aluno(s)` : null}
                      onOpen={() => { setSelectedCourse(course); setSheet("course"); }}
                      onEnroll={() => setTab("enrollments")}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className={schoolTw.section}>
            <h3 className={schoolTw.sectionTitle}><UsersRound size={18} aria-hidden="true" /> Acesso rápido</h3>
            <div className="flex flex-wrap gap-2">
              <QuickAction icon={<BookOpen size={20} />} label="Nova aula" hint="Aluno, curso, conteúdo e presença" onClick={() => setTab("lesson")} testId="school-quick-lesson" />
              <QuickAction icon={<CalendarDays size={20} />} label="Minhas aulas" hint="Histórico, faltas e gráficos" onClick={() => setTab("history")} testId="school-quick-history" />
              <QuickAction icon={<Wallet size={20} />} label="Financeiro" hint="Por aluno e consolidado" onClick={() => setTab("finance")} testId="school-quick-finance" />
            </div>
          </div>
        </>
      ) : null}

      {tab === "lesson" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className={schoolTw.card} aria-label="Registro de aula">
            <div className={schoolTw.sectionHead}>
              <h3 className={schoolTw.sectionTitle}><BookOpen size={18} aria-hidden="true" /> Registrar aula de hoje</h3>
              <p className={schoolTw.sectionHint}>Selecione o aluno e o curso que você está ministrando.</p>
            </div>
            <div className={schoolTw.progress} aria-label="Etapas">
              <span className={form.studentId ? schoolTw.progressDone : schoolTw.progressStep} />
              <span className={form.studentId && form.courseId && form.teacherId ? schoolTw.progressDone : schoolTw.progressStep} />
              <span className={form.title && form.content ? schoolTw.progressDone : schoolTw.progressStep} />
            </div>
            <form className="grid gap-4" onSubmit={(event) => void submitLesson(event)} data-testid="school-lesson-flow">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={schoolTw.label}>Aluno
                  <select className={schoolTw.select} required value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value, sessionId: "new" })}>
                    <option value="">Selecione o aluno</option>
                    {students.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <label className={schoolTw.label}>Professor
                  <select className={schoolTw.select} required value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value, courseId: "", sessionId: "new" })}>
                    <option value="">Selecione</option>
                    {teachers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <label className={schoolTw.label}>Curso do aluno
                  <select className={schoolTw.select} required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value, sessionId: "new" })}>
                    <option value="">Selecione o curso</option>
                    {courses.filter((course) => course.kind !== "SUBJECT").map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                  </select>
                </label>
                <label className={schoolTw.label}>Aula
                  <select className={schoolTw.select} value={form.sessionId} onChange={(event) => setForm({ ...form, sessionId: event.target.value })}>
                    <option value="new">Nova aula (registrar agora)</option>
                    {classSessions.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.sessionDate)} · {item.status}</option>)}
                  </select>
                </label>
                <label className={schoolTw.label}>Data
                  <input className={schoolTw.input} type="date" required value={form.sessionDate} onChange={(event) => setForm({ ...form, sessionDate: event.target.value })} />
                </label>
              </div>

              <div className="grid gap-3">
                <label className={schoolTw.label}>Título da aula
                  <input className={schoolTw.input} required maxLength={120} placeholder="Ex.: Ritmo e afinação — escala maior" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                </label>
                <label className={schoolTw.label}>Conteúdo da aula
                  <textarea className={schoolTw.textarea} required rows={5} placeholder="O que foi estudado, exercícios, próximos passos…" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
                </label>
              </div>

              <div className="grid gap-3 rounded-2xl border border-gray-200 bg-zinc-100 p-4" data-testid="school-paired-attendance">
                <strong className="text-sm font-extrabold text-slate-950">Presença na mesma aula</strong>
                {([
                  { key: "studentStatus" as const, label: `Aluno · ${nameOf(people, form.studentId)}` },
                  { key: "teacherStatus" as const, label: `Professor · ${nameOf(people, form.teacherId)}` },
                ]).map((entry) => (
                  <div key={entry.key} className="grid gap-2">
                    <span className={schoolTw.label}>{entry.label}</span>
                    <div className="flex flex-wrap gap-2">
                      {ATTENDANCE_STATES.map((state) => (
                        <button
                          key={state}
                          type="button"
                          aria-pressed={form[entry.key] === state}
                          className={form[entry.key] === state ? schoolTw.chipActive : schoolTw.chip}
                          onClick={() => setForm({ ...form, [entry.key]: state })}
                          data-testid={`${entry.key}-${state.toLowerCase()}`}
                        >
                          {STATUS_LABEL[state]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <label className={schoolTw.label}>Observação
                  <input className={schoolTw.input} maxLength={240} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
                </label>
              </div>

              <button type="submit" className={schoolTw.buttonPrimary} disabled={busy || !form.studentId || !form.courseId || !form.teacherId} data-testid="school-lesson-submit">
                <Send size={18} aria-hidden="true" /> {busy ? "Salvando…" : "Salvar aula e presença"}
              </button>
            </form>
          </section>

          <aside className={schoolTw.card} aria-label="Resumo do contrato do aluno">
            <h3 className={schoolTw.sectionTitle}><ClipboardCheck size={18} aria-hidden="true" /> Contrato do aluno</h3>
            {!form.studentId || !form.courseId ? <p className={schoolTw.empty}>Selecione aluno e curso para ver o saldo.</p> : (
              <div className="grid gap-3">
                <div className={schoolTw.cardSoft}>
                  <span className={schoolTw.metricLabel}>Aluno</span>
                  <strong className="text-sm font-extrabold text-slate-950">{nameOf(people, form.studentId)}</strong>
                  <span className={schoolTw.note}>{courseOf(form.courseId)?.name || "Curso"} · {nameOf(people, form.teacherId)}</span>
                </div>
                <MetricTile icon={<Clock3 size={20} />} label="Aulas restantes" value={selectedBalance?.balance ?? "—"} hint={selectedBalance ? `De ${selectedBalance.contracted} contratadas` : "Matrícula não encontrada"} testId="lesson-selected-balance" tone="amber" />
                <MetricTile icon={<AlertTriangle size={20} />} label="Faltas do aluno" value={attendances.filter((item) => item.personKind === "STUDENT" && item.personId === form.studentId && ["ABSENT", "JUSTIFIED"].includes(item.status)).length} hint="Ausências e justificadas" testId="lesson-selected-absences" tone="red" />
                {selectedEnrollment ? <button type="button" className={schoolTw.buttonSoft} onClick={() => openPayment(selectedEnrollment.id)}>Registrar pagamento</button> : null}
                {!selectedEnrollment ? <p className={schoolTw.note}>Este aluno ainda não possui matrícula neste curso.</p> : null}
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "history" ? (
        <>
          <div className={schoolTw.hero}>
            <div>
              <h2 className={schoolTw.heroTitle}>Aulas, faltas e presença</h2>
              <p className={schoolTw.heroCopy}>Histórico do que foi ministrado e dos registros de presença — sem transformar configuração em envio confirmado.</p>
            </div>
          </div>
          <div className={schoolTw.metricGrid}>
            <MetricTile icon={<GraduationCap size={20} />} label="Aulas ministradas" value={heldLessons} hint="Sessões realizadas" testId="history-held" tone="green" />
            <MetricTile icon={<ClipboardCheck size={20} />} label="Presenças" value={presenceCount} hint="Alunos presentes" testId="history-present" tone="blue" />
            <MetricTile icon={<AlertTriangle size={20} />} label="Faltas" value={absences} hint="Ausências e justificadas" testId="history-absences" tone="red" />
            <MetricTile icon={<RefreshCw size={20} />} label="Reposições" value={makeupCount} hint="Aulas repostas" testId="history-makeups" tone="amber" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <BarChart title="Aulas por aluno" values={classChart.map((item) => item.value)} captions={classChart.map((item) => item.caption)} testId="history-chart-classes" />
            <BarChart title="Presença, falta e reposição" values={[presenceCount, absences, makeupCount]} captions={["Presentes", "Faltas", "Reposições"]} testId="history-chart-attendance" />
          </div>
          <div className={schoolTw.section}>
            <h3 className={schoolTw.sectionTitle}><CalendarDays size={18} aria-hidden="true" /> Últimas aulas</h3>
            {sessions.length === 0 ? <p className={schoolTw.empty}>Nenhuma aula registrada.</p> : (
              <div className={schoolTw.list}>
                {sessions.slice(0, 20).map((session) => {
                  const records = attendances.filter((item) => item.sessionId === session.id);
                  const plan = lessonPlans.find((item) => item.classId === session.classId);
                  return (
                    <article key={session.id} className={schoolTw.row} data-testid={`school-session-${session.id}`}>
                      <div className="grid min-w-0 gap-1">
                        <strong className="truncate text-sm font-extrabold text-slate-950">{classLabel(session.classId)} · {dateLabel(session.sessionDate)}</strong>
                        <span className={schoolTw.note}>{plan?.title || "Sem título registrado"} · {records.length} presença(s)</span>
                        <div className="flex flex-wrap gap-1.5">
                          {records.slice(0, 6).map((record) => <span key={record.id} className={schoolTw.chip}>{shortName(nameOf(people, record.personId))}: {STATUS_LABEL[record.status] || record.status}</span>)}
                        </div>
                      </div>
                      <span className={session.status === "HELD" ? "text-xs font-extrabold text-emerald-600" : "text-xs font-extrabold text-slate-600"}>{session.status}</span>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {tab === "finance" ? (
        <>
          <div className={schoolTw.hero}>
            <div>
              <h2 className={schoolTw.heroTitle}>Financeiro por aluno e consolidado</h2>
              <p className={schoolTw.heroCopy}>Valores informados por pessoas, com recebimentos registrados. Nenhuma cobrança é reivindicada como enviada sem confirmação.</p>
            </div>
          </div>
          <div className={schoolTw.metricGrid}>
            <MetricTile icon={<Wallet size={20} />} label="Recebido" value={money(paidCents)} hint="Soma dos recebimentos" testId="finance-paid" tone="green" />
            <MetricTile icon={<ClipboardCheck size={20} />} label="Valor contratado" value={money(contractCents)} hint="Soma dos contratos" testId="finance-contract" tone="blue" />
            <MetricTile icon={<AlertTriangle size={20} />} label="Em atraso" value={overdue} hint="Matrículas com parcelas vencidas" testId="finance-overdue" tone="red" />
            <MetricTile icon={<Clock3 size={20} />} label="Aulas restantes" value={remaining} hint="Saldo contratual" testId="finance-remaining" tone="amber" />
          </div>
          <BarChart title="Recebido por aluno (R$)" values={financeChart.map((item) => item.value)} captions={financeChart.map((item) => item.caption)} testId="finance-chart-students" />
          <div className={schoolTw.section}>
            <h3 className={schoolTw.sectionTitle}><UsersRound size={18} aria-hidden="true" /> Alunos</h3>
            {balances.length === 0 ? <p className={schoolTw.empty}>Nenhuma matrícula financeira encontrada.</p> : (
              <div className={schoolTw.list}>
                {balances.map((balance) => {
                  const student = students.find((item) => item.id === balance.studentId);
                  return (
                    <article key={balance.enrollmentId} className={schoolTw.row} data-testid={`finance-student-${balance.studentId}`}>
                      <div className="grid min-w-0 gap-1">
                        <strong className="truncate text-sm font-extrabold text-slate-950">{student?.name || "Aluno"}</strong>
                        <span className={schoolTw.note}>{classLabel(balance.classId)} · {balance.balance} aula(s) restante(s)</span>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={schoolTw.chip}>Pago: {money(balance.paidCents || 0)}</span>
                          <span className={schoolTw.chip}>Mensalidade: {money(balance.tuition.amountCents)}</span>
                          {balance.tuition.nextDueDate ? <span className={schoolTw.chip}>Vence {dateLabel(balance.tuition.nextDueDate)}</span> : null}
                          {Number(balance.overdueInstallments || 0) > 0 ? <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-extrabold text-red-600">{balance.overdueInstallments} atraso(s)</span> : null}
                        </div>
                      </div>
                      <div className={schoolTw.actions}>
                        <button type="button" className={schoolTw.buttonSoft} onClick={() => openPayment(balance.enrollmentId)}>Baixa</button>
                        <button type="button" className={schoolTw.buttonSoft} disabled={busy} onClick={() => void markOverdue(balance.enrollmentId)}>Marcar atraso</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}

      {tab === "enrollments" ? <SchoolEnrollmentsWorkspace /> : null}

      {sheet === "course" && selectedCourse ? (
        <SchoolSheet
          title={selectedCourse.name}
          subtitle={`${selectedCourse.level || "Curso"} · ${money(selectedCourse.tuitionAmountCents)}`}
          onClose={() => setSheet(null)}
          testId="school-course-sheet"
          footer={<button type="button" className={schoolTw.buttonPrimary} onClick={() => { setSheet(null); setTab("enrollments"); }}><Link2 size={17} aria-hidden="true" /> Criar link de matrícula</button>}
        >
          <div className="grid gap-3">
            <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-amber-100 via-blue-50 to-slate-100">
              {selectedCourse.imageUrl ? (
                <img src={selectedCourse.imageUrl} alt={`Foto do curso ${selectedCourse.name}`} className="size-full object-cover" />
              ) : <Music2 size={44} aria-hidden="true" className="text-amber-600" />}
            </div>
            <p className="m-0 text-sm leading-relaxed text-slate-600">{selectedCourse.summary || "Este curso ainda não possui detalhes cadastrados."}</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedCourse.durationLabel ? <span className={schoolTw.chip}><Clock3 size={13} aria-hidden="true" /> {selectedCourse.durationLabel}</span> : null}
              {selectedCourse.level ? <span className={schoolTw.chip}>{selectedCourse.level}</span> : null}
            </div>
            <div className={schoolTw.section}>
              <strong className="text-sm font-extrabold text-slate-950">Alunos deste curso</strong>
              {enrollments.filter((item) => classes.some((row) => row.id === item.classId && row.courseId === selectedCourse.id)).length === 0 ? (
                <p className={schoolTw.note}>Nenhum aluno matriculado neste curso.</p>
              ) : (
                <div className={schoolTw.list}>
                  {enrollments.filter((item) => classes.some((row) => row.id === item.classId && row.courseId === selectedCourse.id)).map((item) => (
                    <div key={item.id} className={schoolTw.row}>
                      <span className="text-sm font-bold text-slate-950">{nameOf(people, item.studentId)}</span>
                      <span className={schoolTw.note}>{classLabel(item.classId)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SchoolSheet>
      ) : null}

      {sheet === "payment" ? (
        <SchoolSheet
          title="Registrar recebimento"
          subtitle="Baixa informada por humano — nenhuma cobrança automática é executada"
          onClose={() => setSheet(null)}
          testId="school-payment-sheet"
          footer={<button type="submit" form="school-payment-form" className={schoolTw.buttonPrimary} disabled={busy}>{busy ? "Salvando…" : "Salvar recebimento"}</button>}
        >
          <form id="school-payment-form" className="grid gap-3" onSubmit={(event) => void submitPayment(event)}>
            <label className={schoolTw.label}>Matrícula
              <select className={schoolTw.select} required value={payment.enrollmentId} onChange={(event) => setPayment({ ...payment, enrollmentId: event.target.value })}>
                <option value="">Selecione</option>
                {enrollments.map((item) => <option key={item.id} value={item.id}>{nameOf(people, item.studentId)} — {classLabel(item.classId)}</option>)}
              </select>
            </label>
            <label className={schoolTw.label}>Valor recebido (centavos)
              <input className={schoolTw.input} type="number" min={1} required value={payment.amountCents} onChange={(event) => setPayment({ ...payment, amountCents: event.target.value })} />
            </label>
            <label className={schoolTw.label}>Data
              <input className={schoolTw.input} type="date" required value={payment.paidAt} onChange={(event) => setPayment({ ...payment, paidAt: event.target.value })} />
            </label>
            <label className={schoolTw.label}>Origem
              <select className={schoolTw.select} value={payment.source} onChange={(event) => setPayment({ ...payment, source: event.target.value })}>
                <option value="CASH">Informado por humano</option>
                <option value="PROVIDER_CONFIRMED">Provedor confirmado</option>
              </select>
            </label>
            <label className={schoolTw.label}>Referência externa
              <input className={schoolTw.input} value={payment.externalReference} onChange={(event) => setPayment({ ...payment, externalReference: event.target.value })} />
            </label>
          </form>
        </SchoolSheet>
      ) : null}
    </section>
  );
}
