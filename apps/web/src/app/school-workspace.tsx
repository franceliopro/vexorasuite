"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookOpen, GraduationCap, Music2, RefreshCw, UsersRound, Wallet } from "lucide-react";
import { CourseCard, schoolTw, type Course } from "./school-ui";

/**
 * Gestão escolar enxuta do segmento music-school.
 * Cursos padrão, professores (com formação), alunos e matrículas individuais.
 * Não existe "turma" nesta tela: o vínculo aluno/curso/professor é criado no servidor.
 */
type Person = { id: string; kind: "STUDENT" | "TEACHER"; name: string; formation?: string | null; active: boolean };
type Snapshot = {
  courses: Course[];
  defaultCourses?: Course[];
  people: Person[];
  warnings?: string[];
};
type SeedResult = { created: number; total: number };

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

/** Foto enviada do computador: o servidor normaliza e guarda os bytes no tenant. */
async function uploadCoursePhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/backend/school/images/course", { method: "POST", body });
  const data = await response.json().catch(() => ({})) as { imageUrl?: string; message?: string };
  if (!response.ok || !data.imageUrl) throw new Error(data.message || "Não foi possível enviar a foto do curso.");
  return data.imageUrl;
}

const today = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export function SchoolWorkspace() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: "", summary: "" });
  const [coursePhoto, setCoursePhoto] = useState<File | null>(null);
  const [teacherForm, setTeacherForm] = useState({ name: "", formation: "" });
  const [studentForm, setStudentForm] = useState({ name: "" });
  const [enrollForm, setEnrollForm] = useState({
    studentId: "", courseId: "", teacherId: "", contractedSessions: "8",
    tuitionAmountCents: "", tuitionNextDueDate: "", contractTotalCents: "",
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
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a gestão escolar.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (
    event: FormEvent,
    path: string,
    payload: Record<string, unknown>,
    message: string,
    reset?: () => void,
  ) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(payload) });
      setNotice(message);
      reset?.();
      await load(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const submitCourse = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const imageUrl = coursePhoto ? await uploadCoursePhoto(coursePhoto) : null;
      await api("school/records", {
        method: "POST",
        body: JSON.stringify({
          kind: "COURSE",
          name: courseForm.name,
          imageUrl,
          summary: courseForm.summary || null,
        }),
      });
      setNotice("Curso cadastrado nesta empresa.");
      setCourseForm({ name: "", summary: "" });
      setCoursePhoto(null);
      await load(false);
    } catch (courseError) {
      setError(courseError instanceof Error ? courseError.message : "Não foi possível cadastrar o curso.");
    } finally {
      setBusy(false);
    }
  };

  const courses = snapshot?.courses || [];
  const people = snapshot?.people || [];
  const students = people.filter((person) => person.kind === "STUDENT" && person.active !== false);
  const teachers = people.filter((person) => person.kind === "TEACHER" && person.active !== false);

  return (
    <section className={schoolTw.shell} aria-label="Gestão escolar">
      <div className={schoolTw.hero}>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-600">Escola de música e instrumentos</p>
          <h2 className={schoolTw.heroTitle}>Cadastros da escola</h2>
          <p className={schoolTw.heroCopy}>Cursos, professores com formação, alunos e matrículas individuais. Cobranças, lembretes e notificações ficam configurados — nenhum envio é afirmado sem evidência.</p>
        </div>
        <button type="button" className={schoolTw.buttonSoft} onClick={() => void load(false)}><RefreshCw size={16} aria-hidden="true" /> Atualizar</button>
      </div>

      {error ? <p role="status" className="rounded-xl border border-red-100 bg-red-100 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-600">{notice}</p> : null}
      {(snapshot?.warnings || []).map((warning) => (
        <p key={warning} role="status" className="rounded-xl border border-amber-100 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-700">{warning}</p>
      ))}

      <div className={schoolTw.section}>
        <div className={schoolTw.sectionHead}>
          <h3 className={schoolTw.sectionTitle}><Music2 size={18} aria-hidden="true" /> Cursos</h3>
          <p className={schoolTw.sectionHint}>Violão, Baixo, Teclado, Bateria, Sax e Canto entram como padrão. Outros cursos depois.</p>
        </div>
        {courses.length === 0 ? <p className={schoolTw.empty}>Nenhum curso cadastrado nesta empresa.</p> : (
          <div className={schoolTw.grid}>
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>

      <div className={schoolTw.grid}>
        <details className={schoolTw.card} data-testid="school-course-form">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">Novo curso</summary>
          <form className="grid gap-3" onSubmit={(event) => void submitCourse(event)}>
            <label className={schoolTw.label}>Nome do curso<input className={schoolTw.input} required maxLength={80} placeholder="Ex.: Violão" value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} /></label>
            <label className={schoolTw.label}>Foto do computador
              <input
                className={schoolTw.input}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                data-testid="school-course-photo"
                onChange={(event) => setCoursePhoto(event.target.files?.[0] ?? null)}
              />
            </label>
            {coursePhoto ? <p className={schoolTw.note}>Arquivo selecionado: {coursePhoto.name}. A foto é enviada e salva nesta empresa ao cadastrar.</p> : null}
            <label className={schoolTw.label}>Descrição / detalhes<textarea className={schoolTw.textarea} rows={3} maxLength={2000} placeholder="O que o aluno aprende neste curso" value={courseForm.summary} onChange={(event) => setCourseForm({ ...courseForm, summary: event.target.value })} /></label>
            <button className={schoolTw.buttonPrimary} type="submit" disabled={busy}>Cadastrar curso</button>
          </form>
        </details>

        <details className={schoolTw.card} data-testid="school-teacher-form">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">Novo professor</summary>
          <form className="grid gap-3" onSubmit={(event) => void submit(
            event,
            "school/records",
            { kind: "TEACHER", name: teacherForm.name, formation: teacherForm.formation || null },
            "Professor cadastrado nesta empresa.",
            () => setTeacherForm({ name: "", formation: "" }),
          )}>
            <label className={schoolTw.label}>Nome<input className={schoolTw.input} required maxLength={120} value={teacherForm.name} onChange={(event) => setTeacherForm({ ...teacherForm, name: event.target.value })} /></label>
            <label className={schoolTw.label}>Formação<input className={schoolTw.input} maxLength={240} placeholder="Ex.: Licenciatura em Música" value={teacherForm.formation} onChange={(event) => setTeacherForm({ ...teacherForm, formation: event.target.value })} /></label>
            <button className={schoolTw.buttonPrimary} type="submit" disabled={busy}>Cadastrar professor</button>
          </form>
        </details>

        <details className={schoolTw.card} data-testid="school-student-form">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">Novo aluno</summary>
          <form className="grid gap-3" onSubmit={(event) => void submit(
            event,
            "school/records",
            { kind: "STUDENT", name: studentForm.name },
            "Aluno cadastrado nesta empresa.",
            () => setStudentForm({ name: "" }),
          )}>
            <label className={schoolTw.label}>Nome<input className={schoolTw.input} required maxLength={120} value={studentForm.name} onChange={(event) => setStudentForm({ name: event.target.value })} /></label>
            <button className={schoolTw.buttonPrimary} type="submit" disabled={busy}>Cadastrar aluno</button>
          </form>
        </details>

        <details className={schoolTw.card} data-testid="school-enroll-form">
          <summary className="cursor-pointer text-sm font-bold text-slate-950">Matricular aluno individualmente</summary>
          <form className="grid gap-3" onSubmit={(event) => void submit(
            event,
            "school/records",
            {
              kind: "ENROLLMENT",
              studentId: enrollForm.studentId,
              courseId: enrollForm.courseId,
              teacherId: enrollForm.teacherId,
              contractedSessions: Number(enrollForm.contractedSessions),
              purchasedSessions: 0,
              tuitionAmountCents: enrollForm.tuitionAmountCents ? Number(enrollForm.tuitionAmountCents) : null,
              tuitionNextDueDate: enrollForm.tuitionNextDueDate || null,
              contractTotalCents: enrollForm.contractTotalCents ? Number(enrollForm.contractTotalCents) : 0,
            },
            "Matrícula individual registrada. Nenhuma cobrança foi enviada.",
          )}>
            <label className={schoolTw.label}>Aluno
              <select className={schoolTw.select} required value={enrollForm.studentId} onChange={(event) => setEnrollForm({ ...enrollForm, studentId: event.target.value })}>
                <option value="">Selecione</option>
                {students.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label className={schoolTw.label}>Curso
              <select className={schoolTw.select} required value={enrollForm.courseId} onChange={(event) => setEnrollForm({ ...enrollForm, courseId: event.target.value })}>
                <option value="">Selecione</option>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </label>
            <label className={schoolTw.label}>Professor
              <select className={schoolTw.select} required value={enrollForm.teacherId} onChange={(event) => setEnrollForm({ ...enrollForm, teacherId: event.target.value })}>
                <option value="">Selecione</option>
                {teachers.map((person) => <option key={person.id} value={person.id}>{person.name}{person.formation ? ` · ${person.formation}` : ""}</option>)}
              </select>
            </label>
            <label className={schoolTw.label}>Aulas contratadas<input className={schoolTw.input} type="number" min={1} max={1000} required value={enrollForm.contractedSessions} onChange={(event) => setEnrollForm({ ...enrollForm, contractedSessions: event.target.value })} /></label>
            <label className={schoolTw.label}>Valor total do contrato em centavos<input className={schoolTw.input} type="number" min={0} value={enrollForm.contractTotalCents} onChange={(event) => setEnrollForm({ ...enrollForm, contractTotalCents: event.target.value })} /></label>
            <label className={schoolTw.label}>Mensalidade em centavos (opcional)<input className={schoolTw.input} type="number" min={0} value={enrollForm.tuitionAmountCents} onChange={(event) => setEnrollForm({ ...enrollForm, tuitionAmountCents: event.target.value })} /></label>
            <label className={schoolTw.label}>Próximo vencimento<input className={schoolTw.input} type="date" min={today()} value={enrollForm.tuitionNextDueDate} onChange={(event) => setEnrollForm({ ...enrollForm, tuitionNextDueDate: event.target.value })} /></label>
            <button className={schoolTw.buttonPrimary} type="submit" disabled={busy}>Matricular</button>
          </form>
        </details>
      </div>

      <div className={schoolTw.section}>
        <h3 className={schoolTw.sectionTitle}><BookOpen size={18} aria-hidden="true" /> Regras da escola</h3>
        <div className={schoolTw.grid}>
          <article className={schoolTw.cardSoft}>
            <Wallet size={20} aria-hidden="true" className="text-amber-600" />
            <strong className="text-sm font-extrabold text-slate-950">Inadimplência e contrato</strong>
            <p className={schoolTw.note}>Duas mensalidades em atraso sugerem cancelamento e inadimplência. Quebra de contrato calcula 20% sobre o saldo restante. Aprovação humana continua necessária.</p>
          </article>
          <article className={schoolTw.cardSoft}>
            <GraduationCap size={20} aria-hidden="true" className="text-amber-600" />
            <strong className="text-sm font-extrabold text-slate-950">Aula e presença</strong>
            <p className={schoolTw.note}>Presença de aluno e professor, resumo do que foi estudado e dias de aula contabilizados no histórico.</p>
          </article>
          <article className={schoolTw.cardSoft}>
            <UsersRound size={20} aria-hidden="true" className="text-amber-600" />
            <strong className="text-sm font-extrabold text-slate-950">Lembretes agendados</strong>
            <p className={schoolTw.note}>Professor 30 minutos antes da aula; pagamento 5 dias antes, no vencimento e diariamente após o atraso, pelos canais consentidos. A baixa também fica configurada para avisar aluno e professor, sem disparo executado por esta tela.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
