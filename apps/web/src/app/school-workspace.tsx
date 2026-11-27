"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  GraduationCap, BookOpen, CalendarDays, UsersRound, ClipboardCheck, Wallet, BellRing, ClipboardList,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Code2, Undo2, Redo2, Link2, ImagePlus, Paperclip, Youtube, FileText,
} from "lucide-react";

type Course = { id: string; kind: "COURSE" | "SUBJECT"; name: string; parentId: string | null; active: boolean };
type Person = { id: string; kind: "STUDENT" | "TEACHER"; name: string; email: string | null; phone: string | null; active: boolean };
type Room = { id: string; name: string; capacity: number; active: boolean };
type ClassRow = { id: string; courseId: string; teacherId: string; roomId: string; name: string; weekday: number; startTime: string; durationMinutes: number; active: boolean };
type Enrollment = { id: string; classId: string; studentId: string; contractedSessions: number; purchasedSessions: number; status: string; tuitionAmountCents: number | null; tuitionCycle: string | null; tuitionStatus: string; tuitionNextDueDate: string | null };
type SessionRow = { id: string; classId: string; sessionDate: string; status: string };
type Attendance = { id: string; sessionId: string; personId: string; personKind: string; status: string; note: string | null; recordedAt: string | null };
type LessonPlan = { id: string; classId: string; version: number; title: string; objectiveHtml: string; contentHtml: string; activitiesHtml: string; observationsHtml: string; materials: string[]; youtubeUrls: string[]; createdAt: string | null };
type Grade = { id: string; classId: string; studentId: string; title: string; evaluationDate: string | null; maxScore: number; score: number; note: string | null };
type Guardian = { id: string; studentId: string; name: string; relationship: string; phone: string | null; email: string | null };
type Notice = { id: string; studentId: string | null; classId: string | null; title: string; bodyHtml: string; channel: string; status: string; scheduledAt: string | null };
type Material = { id: string; lessonPlanId: string | null; courseId: string | null; title: string; url: string; kind: string };
type Balance = {
  enrollmentId: string;
  classId: string;
  studentId: string;
  status: string;
  tuition: { status: string; amountCents: number | null; nextDueDate: string | null; executed: boolean; confirmed: boolean };
  contracted: number;
  consumed: number;
  balance: number;
  pendingMakeups: number;
};
type Stats = {
  students: { sessions: number; present: number; absences: number; percentage: number };
  teachers: { sessions: number; present: number; absences: number; percentage: number };
};
type Snapshot = {
  courses: Course[];
  people: Person[];
  rooms: Room[];
  classes: ClassRow[];
  enrollments: Enrollment[];
  sessions: SessionRow[];
  attendances: Attendance[];
  lessonPlans: LessonPlan[];
  grades: Grade[];
  guardians: Guardian[];
  notices: Notice[];
  materials: Material[];
  balances: Balance[];
  stats: Stats;
};

const DAYS = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const ATTENDANCE_STATUS: Record<string, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  JUSTIFIED: "Ausência justificada",
  MAKEUP: "Reposição",
  CANCELLED: "Cancelada",
};
const TUITION_STATUS: Record<string, string> = {
  SCHEDULED: "Cobrança agendada — não enviada",
  SENT: "Enviada — aguardando evidência",
  FAILED: "Falha registrada",
  CANCELLED: "Cancelada",
};
const NOTICE_STATUS: Record<string, string> = {
  SCHEDULED: "Agendado — nenhum envio executado",
  DRAFT: "Rascunho — nenhum envio executado",
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
const editorShellTw = "grid min-w-0 overflow-hidden rounded-token-sm border border-line bg-surface";
const editorToolbarTw = "flex flex-wrap items-center gap-0.5 border-b border-line bg-surface px-2 py-2";
const editorButtonTw = "grid min-h-control min-w-8 place-items-center rounded-token-sm px-1 text-ink-secondary transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const editorButtonActiveTw = "grid min-h-control min-w-8 place-items-center rounded-token-sm bg-blue-600 px-1 text-blue-50 transition-colors hover:bg-blue-700";
const editorButtonClass = (active: boolean) => active ? editorButtonActiveTw : editorButtonTw;
const editorBarTw = "flex items-center gap-2 border-b border-line bg-surface px-2 py-2";
const editorInputTw = "min-h-control min-w-0 flex-1 rounded-token-sm border border-line bg-surface px-2 text-body text-ink";
const richContentTw = "min-h-32 break-words px-3 py-2.5 text-body leading-relaxed text-ink outline-none";
const sourceTw = "min-h-40 w-full resize-y border-0 px-3 py-2.5 font-mono text-xs leading-relaxed text-ink outline-none";
const editorNoticeTw = "m-0 border-t border-line px-2 py-1.5 text-xs text-red-700";

const RICH_CONTENT_CSS = `
[data-school-rich] p{margin-bottom:0.625rem}
[data-school-rich] p:last-child{margin-bottom:0}
[data-school-rich] :is(h2,h3){margin:0.875rem 0 0.5rem;font-weight:800}
[data-school-rich] :is(ul,ol){margin-bottom:0.625rem;padding-left:1.375rem}
[data-school-rich] a{color:var(--primary);text-decoration:underline}
[data-school-rich] img{max-width:100%;border-radius:0.5rem}
[data-school-rich] iframe{max-width:100%;border:0;border-radius:0.5rem}
[data-school-rich] p.is-editor-empty:first-child::before{content:attr(data-placeholder);float:left;height:0;color:var(--tx2);opacity:0.85;pointer-events:none}
`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload as T;
}

const messageOf = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] || character);

/** Mesmo padrão dos editores existentes: aceita watch, youtu.be e embed. */
const parseYoutubeId = (input: string): string | null => {
  try {
    const url = new URL(String(input || "").trim());
    const host = url.hostname.toLowerCase();
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(host)) return null;
    const raw = host.includes("youtu.be")
      ? url.pathname.replace(/^\//, "").split("/")[0]
      : url.searchParams.get("v") || (url.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{6,20})/)?.[1]) || "";
    return raw && /^[a-zA-Z0-9_-]{6,20}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
};

function youtubeEmbed(url: string): string {
  const id = parseYoutubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : "";
}

/** Nó Tiptap do vídeo: a classe preserva o embed após a sanitização no servidor. */
const SchoolYoutube = Node.create({
  name: "schoolYoutube",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { src: { default: "" }, title: { default: "Vídeo do YouTube" } };
  },
  parseHTML() {
    return [{ tag: "iframe.school-youtube" }];
  },
  renderHTML({ node }) {
    const src = youtubeEmbed(String(node.attrs.src || "")) || String(node.attrs.src || "");
    return ["iframe", mergeAttributes({
      class: "school-youtube",
      src,
      width: "100%",
      height: "360",
      allowfullscreen: "true",
      title: String(node.attrs.title || "Vídeo do YouTube"),
    })];
  },
});

function youtubeUrlsFrom(...values: string[]): string[] {
  const found = values.join("\n").match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[\w-]{6,}/g) || [];
  return Array.from(new Set(found));
}

/** Editor rico do plano de aula: formatação, imagens, arquivos e vídeos incorporados. */
function SchoolRichText({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const [source, setSource] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  const lastEmitted = useRef(value);
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: false } }),
      Image.configure({ inline: true, allowBase64: true }),
      SchoolYoutube,
      Placeholder.configure({ placeholder: label }),
    ],
    content: value,
    editorProps: {
      attributes: { role: "textbox", "aria-label": label, "aria-multiline": "true", "data-school-rich": "", class: richContentTw },
      handlePaste: (_view, event) => {
        const text = String(event.clipboardData?.getData("text/plain") || "");
        const src = youtubeEmbed(text);
        if (!src) return false;
        editorRef.current?.chain().focus().insertContent({ type: "schoolYoutube", attrs: { src, title: "Vídeo do YouTube" } }).run();
        return true;
      },
    },
    onCreate: ({ editor: instance }) => { editorRef.current = instance; },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmitted.current = html;
      current.current.onChange(html);
    },
  }, [label]);

  useEffect(() => {
    if (editor && value !== lastEmitted.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
      lastEmitted.current = editor.getHTML();
    }
  }, [editor, value]);

  const insertYoutube = () => {
    const src = youtubeEmbed(url);
    if (!src) {
      setNotice("Cole um link válido do YouTube (watch, youtu.be ou embed).");
      return;
    }
    editor?.chain().focus().insertContent({ type: "schoolYoutube", attrs: { src, title: "Vídeo do YouTube" } }).run();
    setYoutubeOpen(false);
    setUrl("");
    setNotice("");
  };

  const insertImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice("A imagem excede 2 MB. Escolha um arquivo menor.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      editor?.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const insertFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice("O arquivo excede 2 MB. Escolha um arquivo menor.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const safeName = escapeHtml(file.name);
      editor?.chain().focus().insertContent('<a href="' + dataUrl + '" target="_blank" rel="noopener noreferrer">' + safeName + '</a>').run();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const hasUnderline = typeof (editor as any)?.commands?.toggleUnderline === "function";
  return (
    <div className={editorShellTw}>
      <style>{RICH_CONTENT_CSS}</style>
      <div className={editorToolbarTw} role="toolbar" aria-label="Formatação do plano de aula">
        <button type="button" className={editorButtonTw} title="Desfazer" aria-label="Desfazer" disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonTw} title="Refazer" aria-label="Refazer" disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("bold"))} title="Negrito" aria-label="Negrito" aria-pressed={!!editor?.isActive("bold")} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("italic"))} title="Itálico" aria-label="Itálico" aria-pressed={!!editor?.isActive("italic")} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} aria-hidden="true" /></button>
        {hasUnderline ? <button type="button" className={editorButtonClass(!!editor?.isActive("underline"))} title="Sublinhado" aria-label="Sublinhado" aria-pressed={!!editor?.isActive("underline")} disabled={source} onMouseDown={(event) => event.preventDefault()} onClick={() => (editor as any)?.chain().focus().toggleUnderline().run()}><Underline size={15} aria-hidden="true" /></button> : null}
        <button type="button" className={editorButtonClass(!!editor?.isActive("strike"))} title="Riscado" aria-label="Riscado" aria-pressed={!!editor?.isActive("strike")} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("heading", { level: 2 }))} title="Título 2" aria-label="Título 2" aria-pressed={!!editor?.isActive("heading", { level: 2 })} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><b>H2</b></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("heading", { level: 3 }))} title="Título 3" aria-label="Título 3" aria-pressed={!!editor?.isActive("heading", { level: 3 })} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><b>H3</b></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("bulletList"))} title="Lista com marcadores" aria-label="Lista com marcadores" aria-pressed={!!editor?.isActive("bulletList")} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("orderedList"))} title="Lista numerada" aria-label="Lista numerada" aria-pressed={!!editor?.isActive("orderedList")} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("blockquote"))} title="Citação" aria-label="Citação" aria-pressed={!!editor?.isActive("blockquote")} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonClass(!!editor?.isActive("codeBlock"))} title="Bloco de código" aria-label="Bloco de código" aria-pressed={!!editor?.isActive("codeBlock")} disabled={!editor || source} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonTw} title="Inserir link" aria-label="Inserir link" disabled={source} onMouseDown={(event) => event.preventDefault()} onClick={() => setLinkOpen((open) => !open)}><Link2 size={15} aria-hidden="true" /></button>
        <label className={editorButtonTw} title="Inserir imagem" aria-label="Inserir imagem" onMouseDown={(event) => event.preventDefault()}><ImagePlus size={15} aria-hidden="true" /><input type="file" accept="image/*" className="hidden" onChange={insertImage} /></label>
        <label className={editorButtonTw} title="Inserir arquivo" aria-label="Inserir arquivo" onMouseDown={(event) => event.preventDefault()}><Paperclip size={15} aria-hidden="true" /><input type="file" className="hidden" onChange={insertFile} /></label>
        <button type="button" className={editorButtonTw} title="Inserir vídeo do YouTube" aria-label="Inserir vídeo do YouTube" disabled={source} onMouseDown={(event) => event.preventDefault()} onClick={() => setYoutubeOpen((open) => !open)}><Youtube size={15} aria-hidden="true" /></button>
        <button type="button" className={editorButtonTw} title={source ? "Alternar para modo Visual" : "Alternar para modo Código"} aria-label={source ? "Alternar para modo Visual" : "Alternar para modo Código"} aria-pressed={source} onClick={() => setSource((open) => !open)}><FileText size={15} aria-hidden="true" /><small>{source ? "Visual" : "Código"}</small></button>
      </div>
      {linkOpen ? <div className={editorBarTw}><input className={editorInputTw} aria-label="Endereço do link" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /><button type="button" className={buttonTw} onClick={() => {
        const parsed = url.trim();
        if (/^(https?:\/\/|mailto:|tel:)/i.test(parsed)) {
          editor?.chain().focus().setLink({ href: parsed }).run();
          setLinkOpen(false); setUrl(""); setNotice("");
        } else setNotice("Informe um endereço http(s), mailto: ou tel:.");
      }}>Inserir link</button></div> : null}
      {youtubeOpen ? <div className={editorBarTw}><input className={editorInputTw} aria-label="Link do YouTube" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" /><button type="button" className={buttonTw} onClick={insertYoutube}>Inserir vídeo</button></div> : null}
      {source
        ? <textarea className={sourceTw} aria-label={label + " · HTML"} value={value} onChange={(event) => { onChange(event.target.value); lastEmitted.current = event.target.value; editor?.commands.setContent(event.target.value, { emitUpdate: false }); }} />
        : <EditorContent editor={editor} />}
      {notice ? <p className={editorNoticeTw} role="status">{notice}</p> : null}
    </div>
  );
}

function Donut({ label, percentage }: { label: string; percentage: number }) {
  const value = Math.max(0, Math.min(100, Number(percentage) || 0));
  const circumference = 2 * Math.PI * 28;
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-token-sm border border-line px-3 py-2.5">
      <svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={`Presença de ${label}: ${value}%`}>
        <circle cx="36" cy="36" r="28" fill="none" stroke="#dbe3ee" strokeWidth="9" />
        <circle cx="36" cy="36" r="28" fill="none" stroke="#2563eb" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(value / 100) * circumference} ${circumference}`} transform="rotate(-90 36 36)" />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1f2937">{value}%</text>
      </svg>
      <div className="min-w-0">
        <p className="m-0 text-body font-bold text-ink">{label}</p>
        <p className={mutedTw}>Presença calculada sobre as sessões registradas.</p>
      </div>
    </div>
  );
}

/** Gestão escolar — operação do tenant autenticado. Nenhum envio é executado por aqui. */
export function SchoolWorkspace() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: "" });
  const [subjectForm, setSubjectForm] = useState({ name: "", parentId: "" });
  const [personForm, setPersonForm] = useState({ name: "", kind: "STUDENT", email: "", phone: "" });
  const [roomForm, setRoomForm] = useState({ name: "", capacity: "20" });
  const [classForm, setClassForm] = useState({ name: "", courseId: "", teacherId: "", roomId: "", weekday: "1", startTime: "18:00", durationMinutes: "60" });
  const [enrollForm, setEnrollForm] = useState({ classId: "", studentId: "", contractedSessions: "8", purchasedSessions: "0", tuitionAmountCents: "", tuitionNextDueDate: "" });
  const [sessionForm, setSessionForm] = useState({ classId: "", sessionDate: new Date().toISOString().slice(0, 10), status: "SCHEDULED" });
  const [attendanceForm, setAttendanceForm] = useState({ sessionId: "", personKind: "STUDENT", personId: "", status: "PRESENT", note: "" });
  const [planForm, setPlanForm] = useState({ classId: "", title: "", objectiveHtml: "", contentHtml: "", activitiesHtml: "", observationsHtml: "", materials: "" });
  const [gradeForm, setGradeForm] = useState({ classId: "", studentId: "", title: "", evaluationDate: "", maxScore: "10", score: "", note: "" });
  const [guardianForm, setGuardianForm] = useState({ studentId: "", name: "", relationship: "", phone: "", email: "" });
  const [noticeForm, setNoticeForm] = useState({ studentId: "", classId: "", title: "", bodyHtml: "", channel: "WHATSAPP", scheduledAt: "" });
  const [materialForm, setMaterialForm] = useState({ title: "", url: "", kind: "LINK", lessonPlanId: "", courseId: "" });

  const load = async () => {
    setError("");
    try {
      setSnapshot(await api<Snapshot>("school/snapshot"));
    } catch (cause) {
      setError(messageOf(cause));
    }
  };

  useEffect(() => { void load(); }, []);

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

  const courses = snapshot?.courses ?? [];
  const people = snapshot?.people ?? [];
  const rooms = snapshot?.rooms ?? [];
  const classes = snapshot?.classes ?? [];
  const enrollments = snapshot?.enrollments ?? [];
  const sessions = snapshot?.sessions ?? [];
  const attendances = snapshot?.attendances ?? [];
  const lessonPlans = snapshot?.lessonPlans ?? [];
  const grades = snapshot?.grades ?? [];
  const guardians = snapshot?.guardians ?? [];
  const notices = snapshot?.notices ?? [];
  const materials = snapshot?.materials ?? [];
  const balances = snapshot?.balances ?? [];
  const stats = snapshot?.stats;
  const students = people.filter((person) => person.kind === "STUDENT");
  const teachers = people.filter((person) => person.kind === "TEACHER");
  const nameOf = (id: string) => [...courses, ...people, ...rooms, ...classes].find((item) => item.id === id)?.name || "—";

  return (
    <section className={shellTw} aria-label="Gestão escolar">
      <header className={headerTw}>
        <GraduationCap size={40} className={heroIconTw} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 className={titleTw}>Gestão escolar</h1>
          <p className={copyTw}>Cursos, matérias, turmas, presença, planos de aula, notas e avisos agendados — tudo no contexto da empresa. Avisos e mensalidades ficam apenas agendados, nenhum envio é executado.</p>
        </div>
        <span className={badgeTw}>Avisos e mensalidades agendados — nenhum envio executado</span>
      </header>

      {error ? <p role="status" className="text-body text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="text-body text-green-700">{notice}</p> : null}

      <div className={gridTw}>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><BookOpen size={18} aria-hidden="true" /> Presença dos alunos</h2>
          {stats ? <Donut label="Alunos" percentage={stats.students.percentage} /> : <p className={mutedTw}>Carregando indicadores…</p>}
          {stats ? <p className={mutedTw}>Sessões: {stats.students.sessions} · Presentes: {stats.students.present} · Ausências: {stats.students.absences}</p> : null}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><ClipboardCheck size={18} aria-hidden="true" /> Presença dos professores</h2>
          {stats ? <Donut label="Professores" percentage={stats.teachers.percentage} /> : <p className={mutedTw}>Carregando indicadores…</p>}
          {stats ? <p className={mutedTw}>Sessões: {stats.teachers.sessions} · Presentes: {stats.teachers.present} · Ausências: {stats.teachers.absences}</p> : null}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><Wallet size={18} aria-hidden="true" /> Mensalidades</h2>
          <p className="m-0 text-body text-ink">Valores e vencimentos ficam registrados como agendamento. Nenhuma cobrança é enviada, debitada ou confirmada por esta tela.</p>
          <p className={mutedTw}>Confirmação e execução dependem de evidência do provedor financeiro.</p>
        </article>
      </div>

      <div className={gridTw}>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><BookOpen size={18} aria-hidden="true" /> Cursos e matérias</h2>
          {courses.length === 0 ? <p className={mutedTw}>Nenhum curso ou matéria cadastrado nesta empresa.</p> : null}
          {courses.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.name}</span><span className={mutedTw}>{item.kind === "COURSE" ? "Curso" : "Matéria"}</span></summary>
              <p className={mutedTw}>Curso pai: {item.parentId ? nameOf(item.parentId) : "—"} · {item.active ? "Ativo" : "Inativo"}</p>
            </details>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><UsersRound size={18} aria-hidden="true" /> Pessoas</h2>
          {people.length === 0 ? <p className={mutedTw}>Nenhuma pessoa cadastrada nesta empresa.</p> : null}
          {people.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.name}</span><span className={mutedTw}>{item.kind === "STUDENT" ? "Aluno" : "Professor"}</span></summary>
              <p className={mutedTw}>E-mail: {item.email || "—"} · Telefone: {item.phone || "—"} · {item.active ? "Ativo" : "Inativo"}</p>
            </details>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><CalendarDays size={18} aria-hidden="true" /> Salas</h2>
          {rooms.length === 0 ? <p className={mutedTw}>Nenhuma sala cadastrada nesta empresa.</p> : null}
          {rooms.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.name}</span><span className={mutedTw}>Capacidade: {item.capacity}</span></summary>
              <p className={mutedTw}>{item.active ? "Ativa" : "Inativa"}</p>
            </details>
          ))}
        </article>
      </div>

      <div className={gridTw}>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><CalendarDays size={18} aria-hidden="true" /> Turmas</h2>
          {classes.length === 0 ? <p className={mutedTw}>Nenhuma turma cadastrada nesta empresa.</p> : null}
          {classes.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.name}</span><span className={mutedTw}>{DAYS[item.weekday] || item.weekday} · {item.startTime}</span></summary>
              <p className={mutedTw}>Curso/matéria: {nameOf(item.courseId)} · Professor: {nameOf(item.teacherId)} · Sala: {nameOf(item.roomId)}</p>
              <p className={mutedTw}>Duração: {item.durationMinutes} min · {item.active ? "Ativa" : "Inativa"}</p>
            </details>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><Wallet size={18} aria-hidden="true" /> Matrículas e saldos</h2>
          {balances.length === 0 ? <p className={mutedTw}>Nenhuma matrícula registrada nesta empresa.</p> : null}
          {balances.map((item) => {
            const contracted = Number(item.contracted || 0);
            const consumed = Number(item.consumed || 0);
            const remaining = Math.max(0, Number(item.balance || 0));
            const used = contracted > 0 ? Math.min(100, Math.round((consumed * 100) / contracted)) : 0;
            return (
              <details key={item.enrollmentId} className={rowTw}>
                <summary className={summaryTw}><span>{nameOf(item.studentId)}</span><span className={mutedTw}>{nameOf(item.classId)}</span></summary>
                <p className={mutedTw}>Contratadas: {contracted} · Consumidas: {consumed} · Reposições pendentes: {item.pendingMakeups}</p>
                <p className="m-0 text-body font-bold text-ink">Faltam {remaining} aula(s)</p>
                <div className="h-2 w-full overflow-hidden rounded-token-sm bg-surface"><div className="h-full bg-blue-600" style={{ width: `${used}%` }} /></div>
                <p className={mutedTw}>{TUITION_STATUS[item.tuition.status] || item.tuition.status} · Executado: {item.tuition.executed ? "sim" : "não"} · Confirmado: {item.tuition.confirmed ? "sim" : "não"}</p>
              </details>
            );
          })}
          {enrollments.map((item) => (
            <p key={item.id} className={mutedTw}>Matrícula {item.id} · {item.status} · {TUITION_STATUS[item.tuitionStatus] || item.tuitionStatus}</p>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><ClipboardCheck size={18} aria-hidden="true" /> Sessões e presença</h2>
          {sessions.length === 0 ? <p className={mutedTw}>Nenhuma sessão registrada nesta empresa.</p> : null}
          {sessions.slice(0, 12).map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{nameOf(item.classId)}</span><span className={mutedTw}>{item.sessionDate} · {item.status}</span></summary>
              {attendances.filter((attendance) => attendance.sessionId === item.id).map((attendance) => (
                <p key={attendance.id} className={mutedTw}>{nameOf(attendance.personId)} · {ATTENDANCE_STATUS[attendance.status] || attendance.status}{attendance.note ? ` · ${attendance.note}` : ""}</p>
              ))}
            </details>
          ))}
        </article>
      </div>

      <div className={gridTw}>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><ClipboardList size={18} aria-hidden="true" /> Planos de aula</h2>
          {lessonPlans.length === 0 ? <p className={mutedTw}>Nenhum plano de aula registrado nesta empresa.</p> : null}
          {lessonPlans.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.title}</span><span className={mutedTw}>Versão {item.version} · {nameOf(item.classId)}</span></summary>
              <p className={mutedTw}>Objetivo: {item.objectiveHtml.replace(/<[^>]+>/g, " ").slice(0, 200) || "—"}</p>
              <p className={mutedTw}>Materiais: {item.materials.length > 0 ? item.materials.join(", ") : "—"}</p>
              <p className={mutedTw}>Vídeos: {item.youtubeUrls.length > 0 ? item.youtubeUrls.join(", ") : "—"}</p>
              <p className={mutedTw}>Histórico de versões: versão {item.version} · {item.createdAt || "data não informada"}</p>
            </details>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><ClipboardCheck size={18} aria-hidden="true" /> Notas</h2>
          {grades.length === 0 ? <p className={mutedTw}>Nenhuma nota registrada nesta empresa.</p> : null}
          {grades.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.title}</span><span className={mutedTw}>{item.score}/{item.maxScore}</span></summary>
              <p className={mutedTw}>{nameOf(item.studentId)} · {nameOf(item.classId)} · {item.evaluationDate || "sem data"}</p>
              <p className={mutedTw}>{item.note || "Sem observação"}</p>
            </details>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><UsersRound size={18} aria-hidden="true" /> Responsáveis</h2>
          {guardians.length === 0 ? <p className={mutedTw}>Nenhum responsável cadastrado nesta empresa.</p> : null}
          {guardians.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.name}</span><span className={mutedTw}>{item.relationship}</span></summary>
              <p className={mutedTw}>Aluno: {nameOf(item.studentId)} · Telefone: {item.phone || "—"} · E-mail: {item.email || "—"}</p>
            </details>
          ))}
        </article>
      </div>

      <div className={gridTw}>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><BellRing size={18} aria-hidden="true" /> Avisos agendados</h2>
          {notices.length === 0 ? <p className={mutedTw}>Nenhum aviso agendado nesta empresa.</p> : null}
          {notices.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.title}</span><span className={mutedTw}>{NOTICE_STATUS[item.status] || item.status}</span></summary>
              <p className={mutedTw}>Canal: {item.channel} · Agendado para: {item.scheduledAt || "sem data"}</p>
              <p className={mutedTw}>Aluno: {item.studentId ? nameOf(item.studentId) : "—"} · Turma: {item.classId ? nameOf(item.classId) : "—"}</p>
              <p className={mutedTw}>Nenhuma mensagem foi enviada automaticamente.</p>
            </details>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><BookOpen size={18} aria-hidden="true" /> Materiais</h2>
          {materials.length === 0 ? <p className={mutedTw}>Nenhum material cadastrado nesta empresa.</p> : null}
          {materials.map((item) => (
            <details key={item.id} className={rowTw}>
              <summary className={summaryTw}><span>{item.title}</span><span className={mutedTw}>{item.kind}</span></summary>
              <p className={mutedTw}>URL: {item.url}</p>
              <p className={mutedTw}>Curso: {item.courseId ? nameOf(item.courseId) : "—"} · Plano: {item.lessonPlanId || "—"}</p>
            </details>
          ))}
        </article>
        <article className={cardTw}>
          <h2 className={cardTitleTw}><ClipboardCheck size={18} aria-hidden="true" /> Como usar</h2>
          <p className="m-0 text-body text-ink-secondary">Abra os formulários abaixo para cadastrar cursos, pessoas, turmas, sessões, presenças, planos, notas e avisos. Cada operação é registrada apenas no tenant atual.</p>
          <p className={mutedTw}>Alterações recarregam o painel; envios externos não são realizados.</p>
        </article>
      </div>

      <div className={gridTw}>
        <details className={detailsTw} data-testid="school-course-form">
          <summary className={summaryFormTw}>Novo curso</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "COURSE", ...courseForm }, "Curso cadastrado.")}>
            <label className={labelTw}>Nome<input className={fieldTw} required value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar curso</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-subject-form">
          <summary className={summaryFormTw}>Nova matéria</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "SUBJECT", ...subjectForm }, "Matéria cadastrada.")}>
            <label className={labelTw}>Nome<input className={fieldTw} required value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} /></label>
            <label className={labelTw}>Curso pai<select className={fieldTw} required value={subjectForm.parentId} onChange={(event) => setSubjectForm({ ...subjectForm, parentId: event.target.value })}><option value="">Selecione</option>{courses.filter((item) => item.kind === "COURSE").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar matéria</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-person-form">
          <summary className={summaryFormTw}>Nova pessoa</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: personForm.kind, name: personForm.name, email: personForm.email, phone: personForm.phone }, "Pessoa cadastrada.")}>
            <label className={labelTw}>Nome<input className={fieldTw} required value={personForm.name} onChange={(event) => setPersonForm({ ...personForm, name: event.target.value })} /></label>
            <label className={labelTw}>Tipo<select className={fieldTw} value={personForm.kind} onChange={(event) => setPersonForm({ ...personForm, kind: event.target.value })}><option value="STUDENT">Aluno</option><option value="TEACHER">Professor</option></select></label>
            <label className={labelTw}>E-mail<input className={fieldTw} type="email" value={personForm.email} onChange={(event) => setPersonForm({ ...personForm, email: event.target.value })} /></label>
            <label className={labelTw}>Telefone<input className={fieldTw} value={personForm.phone} onChange={(event) => setPersonForm({ ...personForm, phone: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar pessoa</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-room-form">
          <summary className={summaryFormTw}>Nova sala</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "ROOM", name: roomForm.name, capacity: Number(roomForm.capacity) }, "Sala cadastrada.")}>
            <label className={labelTw}>Nome<input className={fieldTw} required value={roomForm.name} onChange={(event) => setRoomForm({ ...roomForm, name: event.target.value })} /></label>
            <label className={labelTw}>Capacidade<input className={fieldTw} type="number" min={1} value={roomForm.capacity} onChange={(event) => setRoomForm({ ...roomForm, capacity: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar sala</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-class-form">
          <summary className={summaryFormTw}>Nova turma</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "CLASS", name: classForm.name, courseId: classForm.courseId, teacherId: classForm.teacherId, roomId: classForm.roomId, weekday: Number(classForm.weekday), startTime: classForm.startTime, durationMinutes: Number(classForm.durationMinutes) }, "Turma cadastrada.")}>
            <label className={labelTw}>Nome<input className={fieldTw} required value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} /></label>
            <label className={labelTw}>Matéria/curso<select className={fieldTw} required value={classForm.courseId} onChange={(event) => setClassForm({ ...classForm, courseId: event.target.value })}><option value="">Selecione</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Professor<select className={fieldTw} required value={classForm.teacherId} onChange={(event) => setClassForm({ ...classForm, teacherId: event.target.value })}><option value="">Selecione</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Sala<select className={fieldTw} value={classForm.roomId} onChange={(event) => setClassForm({ ...classForm, roomId: event.target.value })}><option value="">Selecione</option>{rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Dia da semana<select className={fieldTw} value={classForm.weekday} onChange={(event) => setClassForm({ ...classForm, weekday: event.target.value })}>{DAYS.slice(1).map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
            <label className={labelTw}>Horário<input className={fieldTw} type="time" required value={classForm.startTime} onChange={(event) => setClassForm({ ...classForm, startTime: event.target.value })} /></label>
            <label className={labelTw}>Duração (minutos)<input className={fieldTw} type="number" min={30} max={180} step={30} value={classForm.durationMinutes} onChange={(event) => setClassForm({ ...classForm, durationMinutes: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar turma</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-enroll-form">
          <summary className={summaryFormTw}>Matricular aluno</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "ENROLLMENT", classId: enrollForm.classId, studentId: enrollForm.studentId, contractedSessions: Number(enrollForm.contractedSessions), purchasedSessions: Number(enrollForm.purchasedSessions), tuitionAmountCents: enrollForm.tuitionAmountCents ? Number(enrollForm.tuitionAmountCents) : null, tuitionNextDueDate: enrollForm.tuitionNextDueDate || null }, "Matrícula registrada. Cobrança agendada, sem envio.")}>
            <label className={labelTw}>Turma<select className={fieldTw} required value={enrollForm.classId} onChange={(event) => setEnrollForm({ ...enrollForm, classId: event.target.value })}><option value="">Selecione</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Aluno<select className={fieldTw} required value={enrollForm.studentId} onChange={(event) => setEnrollForm({ ...enrollForm, studentId: event.target.value })}><option value="">Selecione</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Aulas contratadas<input className={fieldTw} type="number" min={1} value={enrollForm.contractedSessions} onChange={(event) => setEnrollForm({ ...enrollForm, contractedSessions: event.target.value })} /></label>
            <label className={labelTw}>Aulas adicionais<input className={fieldTw} type="number" min={0} value={enrollForm.purchasedSessions} onChange={(event) => setEnrollForm({ ...enrollForm, purchasedSessions: event.target.value })} /></label>
            <label className={labelTw}>Valor mensal (centavos)<input className={fieldTw} type="number" min={0} value={enrollForm.tuitionAmountCents} onChange={(event) => setEnrollForm({ ...enrollForm, tuitionAmountCents: event.target.value })} /></label>
            <label className={labelTw}>Vencimento<input className={fieldTw} type="date" value={enrollForm.tuitionNextDueDate} onChange={(event) => setEnrollForm({ ...enrollForm, tuitionNextDueDate: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Matricular</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-session-form">
          <summary className={summaryFormTw}>Nova sessão</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "SESSION", classId: sessionForm.classId, sessionDate: sessionForm.sessionDate, status: sessionForm.status }, "Sessão registrada.")}>
            <label className={labelTw}>Turma<select className={fieldTw} required value={sessionForm.classId} onChange={(event) => setSessionForm({ ...sessionForm, classId: event.target.value })}><option value="">Selecione</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Data<input className={fieldTw} type="date" required value={sessionForm.sessionDate} onChange={(event) => setSessionForm({ ...sessionForm, sessionDate: event.target.value })} /></label>
            <label className={labelTw}>Status<select className={fieldTw} value={sessionForm.status} onChange={(event) => setSessionForm({ ...sessionForm, status: event.target.value })}><option value="SCHEDULED">Agendada</option><option value="HELD">Realizada</option><option value="CANCELLED">Cancelada</option></select></label>
            <button className={buttonTw} type="submit" disabled={busy}>Registrar sessão</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-attendance-form">
          <summary className={summaryFormTw}>Registrar presença</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/attendances", { sessionId: attendanceForm.sessionId, personKind: attendanceForm.personKind, personId: attendanceForm.personId, status: attendanceForm.status, note: attendanceForm.note }, "Presença registrada.")}>
            <label className={labelTw}>Sessão<select className={fieldTw} required value={attendanceForm.sessionId} onChange={(event) => setAttendanceForm({ ...attendanceForm, sessionId: event.target.value })}><option value="">Selecione</option>{sessions.map((item) => <option key={item.id} value={item.id}>{nameOf(item.classId)} — {item.sessionDate}</option>)}</select></label>
            <label className={labelTw}>Tipo de pessoa<select className={fieldTw} value={attendanceForm.personKind} onChange={(event) => setAttendanceForm({ ...attendanceForm, personKind: event.target.value, personId: "" })}><option value="STUDENT">Aluno</option><option value="TEACHER">Professor</option></select></label>
            <label className={labelTw}>Pessoa<select className={fieldTw} required value={attendanceForm.personId} onChange={(event) => setAttendanceForm({ ...attendanceForm, personId: event.target.value })}><option value="">Selecione</option>{(attendanceForm.personKind === "STUDENT" ? students : teachers).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Status<select className={fieldTw} value={attendanceForm.status} onChange={(event) => setAttendanceForm({ ...attendanceForm, status: event.target.value })}>{Object.entries(ATTENDANCE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={labelTw}>Observação<input className={fieldTw} value={attendanceForm.note} onChange={(event) => setAttendanceForm({ ...attendanceForm, note: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Registrar</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-plan-form">
          <summary className={summaryFormTw}>Novo plano de aula</summary>
          <form className={formTw} onSubmit={(event) => {
            const materials = planForm.materials.split("\n").map((line) => line.trim()).filter(Boolean);
            void submit(event, "school/records", {
              kind: "LESSON_PLAN",
              classId: planForm.classId,
              title: planForm.title,
              objectiveHtml: planForm.objectiveHtml,
              contentHtml: planForm.contentHtml,
              activitiesHtml: planForm.activitiesHtml,
              observationsHtml: planForm.observationsHtml,
              materials,
              youtubeUrls: youtubeUrlsFrom(planForm.objectiveHtml, planForm.contentHtml, planForm.activitiesHtml, planForm.observationsHtml, ...materials),
            }, "Plano de aula registrado.");
          }}>
            <label className={labelTw}>Turma<select className={fieldTw} required value={planForm.classId} onChange={(event) => setPlanForm({ ...planForm, classId: event.target.value })}><option value="">Selecione</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Título<input className={fieldTw} required value={planForm.title} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} /></label>
            <label className={labelTw}>Objetivo<SchoolRichText label="Objetivo" value={planForm.objectiveHtml} onChange={(html) => setPlanForm((current) => ({ ...current, objectiveHtml: html }))} /></label>
            <label className={labelTw}>Conteúdo<SchoolRichText label="Conteúdo" value={planForm.contentHtml} onChange={(html) => setPlanForm((current) => ({ ...current, contentHtml: html }))} /></label>
            <label className={labelTw}>Atividades<SchoolRichText label="Atividades" value={planForm.activitiesHtml} onChange={(html) => setPlanForm((current) => ({ ...current, activitiesHtml: html }))} /></label>
            <label className={labelTw}>Observações<SchoolRichText label="Observações" value={planForm.observationsHtml} onChange={(html) => setPlanForm((current) => ({ ...current, observationsHtml: html }))} /></label>
            <label className={labelTw}>Materiais/URLs (um por linha)<textarea className={fieldTw} rows={4} value={planForm.materials} onChange={(event) => setPlanForm({ ...planForm, materials: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Salvar plano</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-grade-form">
          <summary className={summaryFormTw}>Nova nota</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "GRADE", classId: gradeForm.classId, studentId: gradeForm.studentId, title: gradeForm.title, evaluationDate: gradeForm.evaluationDate, maxScore: Number(gradeForm.maxScore), score: Number(gradeForm.score), note: gradeForm.note }, "Nota registrada.")}>
            <label className={labelTw}>Turma<select className={fieldTw} required value={gradeForm.classId} onChange={(event) => setGradeForm({ ...gradeForm, classId: event.target.value })}><option value="">Selecione</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Aluno<select className={fieldTw} required value={gradeForm.studentId} onChange={(event) => setGradeForm({ ...gradeForm, studentId: event.target.value })}><option value="">Selecione</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Título<input className={fieldTw} required value={gradeForm.title} onChange={(event) => setGradeForm({ ...gradeForm, title: event.target.value })} /></label>
            <label className={labelTw}>Data<input className={fieldTw} type="date" required value={gradeForm.evaluationDate} onChange={(event) => setGradeForm({ ...gradeForm, evaluationDate: event.target.value })} /></label>
            <label className={labelTw}>Nota máxima<input className={fieldTw} type="number" min={1} value={gradeForm.maxScore} onChange={(event) => setGradeForm({ ...gradeForm, maxScore: event.target.value })} /></label>
            <label className={labelTw}>Nota<input className={fieldTw} type="number" min={0} step={1} required value={gradeForm.score} onChange={(event) => setGradeForm({ ...gradeForm, score: event.target.value })} /></label>
            <label className={labelTw}>Observação<input className={fieldTw} value={gradeForm.note} onChange={(event) => setGradeForm({ ...gradeForm, note: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Registrar nota</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-guardian-form">
          <summary className={summaryFormTw}>Novo responsável</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "GUARDIAN", studentId: guardianForm.studentId, name: guardianForm.name, relationship: guardianForm.relationship, phone: guardianForm.phone, email: guardianForm.email }, "Responsável cadastrado.")}>
            <label className={labelTw}>Aluno<select className={fieldTw} required value={guardianForm.studentId} onChange={(event) => setGuardianForm({ ...guardianForm, studentId: event.target.value })}><option value="">Selecione</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Nome<input className={fieldTw} required value={guardianForm.name} onChange={(event) => setGuardianForm({ ...guardianForm, name: event.target.value })} /></label>
            <label className={labelTw}>Parentesco<select className={fieldTw} value={guardianForm.relationship} onChange={(event) => setGuardianForm({ ...guardianForm, relationship: event.target.value })}><option value="">Não informado</option><option value="MAE">Mãe</option><option value="PAI">Pai</option><option value="RESPONSAVEL">Responsável</option><option value="OUTRO">Outro</option></select></label>
            <label className={labelTw}>Telefone<input className={fieldTw} value={guardianForm.phone} onChange={(event) => setGuardianForm({ ...guardianForm, phone: event.target.value })} /></label>
            <label className={labelTw}>E-mail<input className={fieldTw} type="email" value={guardianForm.email} onChange={(event) => setGuardianForm({ ...guardianForm, email: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar responsável</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-notice-form">
          <summary className={summaryFormTw}>Novo aviso agendado</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "NOTICE", studentId: noticeForm.studentId || null, classId: noticeForm.classId || null, title: noticeForm.title, bodyHtml: noticeForm.bodyHtml, channel: noticeForm.channel, status: "SCHEDULED", scheduledAt: noticeForm.scheduledAt || null }, "Aviso agendado. Nenhum envio foi executado.")}>
            <label className={labelTw}>Aluno (opcional)<select className={fieldTw} value={noticeForm.studentId} onChange={(event) => setNoticeForm({ ...noticeForm, studentId: event.target.value })}><option value="">Todos</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Turma (opcional)<select className={fieldTw} value={noticeForm.classId} onChange={(event) => setNoticeForm({ ...noticeForm, classId: event.target.value })}><option value="">Todas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Título<input className={fieldTw} required value={noticeForm.title} onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })} /></label>
            <label className={labelTw}>Corpo<textarea className={fieldTw} rows={4} value={noticeForm.bodyHtml} onChange={(event) => setNoticeForm({ ...noticeForm, bodyHtml: event.target.value })} /></label>
            <label className={labelTw}>Canal<select className={fieldTw} value={noticeForm.channel} onChange={(event) => setNoticeForm({ ...noticeForm, channel: event.target.value })}><option value="WHATSAPP">WhatsApp (agendado — sem envio)</option><option value="EMAIL">E-mail (agendado — sem envio)</option></select></label>
            <label className={labelTw}>Data agendada<input className={fieldTw} type="date" value={noticeForm.scheduledAt} onChange={(event) => setNoticeForm({ ...noticeForm, scheduledAt: event.target.value })} /></label>
            <button className={buttonTw} type="submit" disabled={busy}>Agendar aviso</button>
          </form>
        </details>

        <details className={detailsTw} data-testid="school-material-form">
          <summary className={summaryFormTw}>Novo material</summary>
          <form className={formTw} onSubmit={(event) => void submit(event, "school/records", { kind: "MATERIAL", title: materialForm.title, url: materialForm.url, materialKind: materialForm.kind, lessonPlanId: materialForm.lessonPlanId || null, courseId: materialForm.courseId || null }, "Material cadastrado.")}>
            <label className={labelTw}>Título<input className={fieldTw} required value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} /></label>
            <label className={labelTw}>URL<input className={fieldTw} required value={materialForm.url} onChange={(event) => setMaterialForm({ ...materialForm, url: event.target.value })} /></label>
            <label className={labelTw}>Tipo<select className={fieldTw} value={materialForm.kind} onChange={(event) => setMaterialForm({ ...materialForm, kind: event.target.value })}><option value="LINK">LINK</option><option value="FILE">FILE</option><option value="YOUTUBE">YOUTUBE</option></select></label>
            <label className={labelTw}>Curso (opcional)<select className={fieldTw} value={materialForm.courseId} onChange={(event) => setMaterialForm({ ...materialForm, courseId: event.target.value })}><option value="">Nenhum</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className={labelTw}>Plano de aula (opcional)<select className={fieldTw} value={materialForm.lessonPlanId} onChange={(event) => setMaterialForm({ ...materialForm, lessonPlanId: event.target.value })}><option value="">Nenhum</option>{lessonPlans.map((item) => <option key={item.id} value={item.id}>{item.title} — v{item.version}</option>)}</select></label>
            <button className={buttonTw} type="submit" disabled={busy}>Cadastrar material</button>
          </form>
        </details>
      </div>

      <p className={mutedTw}>Avisos e mensalidades permanecem como SCHEDULED: nenhum envio, cobrança, pagamento ou publicação é realizado por esta tela.</p>
    </section>
  );
}
