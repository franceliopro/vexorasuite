import sanitizeHtml from "sanitize-html";

export const COURSE_KINDS = ["COURSE", "SUBJECT"] as const;
export const PERSON_KINDS = ["STUDENT", "TEACHER", "RESPONSIBLE"] as const;
export const ATTENDANCE_PERSON_KINDS = ["STUDENT", "TEACHER"] as const;
export const BILLING_MODES = ["STUDENT", "GUARDIAN"] as const;
export const CLASS_PERIODS = ["MANHA", "TARDE", "NOITE"] as const;
export const CONTRACT_PERIODS = ["MONTHLY", "QUARTERLY", "SEMESTER", "YEARLY"] as const;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "JUSTIFIED", "MAKEUP", "CANCELLED"] as const;
export const RELATIONSHIPS = ["MAE", "PAI", "RESPONSAVEL", "OUTRO"] as const;
export const NOTICE_CHANNELS = ["WHATSAPP", "SMS", "EMAIL"] as const;
export const MATERIAL_KINDS = ["LINK", "FILE", "YOUTUBE"] as const;
export const SESSION_STATUSES = ["SCHEDULED", "HELD", "CANCELLED"] as const;
export const TUITION_CYCLES = ["MONTHLY", "BIWEEKLY", "WEEKLY"] as const;
export const PAYMENT_RECEIPT_SOURCES = ["CASH", "PROVIDER_CONFIRMED"] as const;
export const CANCELLATION_DECISIONS = ["APPROVE", "REJECT"] as const;
export const RECORD_KINDS = [
  "COURSE", "SUBJECT", "STUDENT", "TEACHER", "RESPONSIBLE", "ROOM", "CLASS", "ENROLLMENT",
  "SESSION", "LESSON_PLAN", "GRADE", "GUARDIAN", "NOTICE", "MATERIAL",
  "LESSON_SUMMARY", "BILLING_POLICY", "PAYMENT_RECEIPT", "MARK_OVERDUE", "CANCELLATION_DECISION",
] as const;

export type CourseKind = (typeof COURSE_KINDS)[number];
export type PersonKind = (typeof PERSON_KINDS)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function text(value: unknown, max: number, label: string): string {
  if (typeof value !== "string") throw new Error(`Informe ${label}.`);
  const result = value.trim();
  if (!result) throw new Error(`Informe ${label}.`);
  if (result.length > max) throw new Error(`${label} deve ter até ${max} caracteres.`);
  return result;
}

export function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, max, label);
}

export function integer(value: unknown, min: number, max: number, label: string): number {
  const raw = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new Error(`${label} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return raw;
}

export function optionalInteger(value: unknown, min: number, max: number, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return integer(value, min, max, label);
}

export function isoDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

export function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function weekday(value: unknown): number {
  return integer(value, 1, 7, "Dia da semana");
}

export function classTime(value: unknown): string {
  const result = text(value, 5, "Horário").trim();
  if (!TIME.test(result)) throw new Error("Informe o horário no formato HH:mm.");
  return result;
}

export function httpsUrl(value: unknown, label: string): string {
  const result = text(value, 2000, label);
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    throw new Error(`${label} deve ser uma URL válida.`);
  }
  if (url.protocol !== "https:") throw new Error(`${label} deve usar HTTPS.`);
  return result;
}

/** Foto do curso enviada do computador ou URL https já existente. */
export function courseImageUrl(value: unknown, label: string): string {
  const result = text(value, 3_000_000, label);
  if (/^https:\/\/\S+$/i.test(result)) return result;
  if (/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(result)) return result;
  throw new Error(`${label} deve ser uma imagem enviada do computador ou uma URL https.`);
}

/** Aceita youtube.com/watch, youtu.be e embed, devolvendo um embed sandbox-friendly. */
export function youtubeEmbed(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!/(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$/.test(host)) return null;
    const id = host === "youtu.be"
      ? url.pathname.slice(1).split("/")[0]
      : url.pathname.startsWith("/embed/")
        ? url.pathname.slice("/embed/".length).split("/")[0]
        : url.searchParams.get("v");
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  } catch {
    return null;
  }
}

/** Lista estática: `sanitizeHtml.defaults` não existe no build ESM/CJS usado na validação. */
const RICH_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span", "br", "hr",
  "b", "strong", "i", "em", "u", "s", "strike", "del", "code", "pre",
  "blockquote", "ul", "ol", "li", "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "iframe",
];
const MAX_RICH_CHARS = 3_000_000;
const MAX_DATA_URI = 2_000_000;
const IMAGE_DATA_URI = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
const FILE_DATA_URI = /^data:(?:image\/(?:png|jpeg|gif|webp)|application\/(?:pdf|msword|octet-stream|vnd\.openxmlformats-officedocument[\w.-]+)|text\/(?:plain|csv));base64,[A-Za-z0-9+/=]+$/;

/** Richtext do Tiptap: HTML comum, imagens/arquivos pequenos e apenas iframes do YouTube. */
export function cleanRichText(value: unknown, label: string): string {
  const raw = typeof value === "string" ? value : "";
  if (raw.length > MAX_RICH_CHARS) throw new Error(`${label} excede o limite de ${MAX_RICH_CHARS} caracteres.`);
  return sanitizeHtml(raw, {
    allowedTags: RICH_TAGS,
    allowedAttributes: {
      "*": ["class"],
      a: ["href", "target", "rel", "class", "title"],
      img: ["src", "alt", "title", "class", "loading"],
      figure: ["class"],
      figcaption: ["class"],
      iframe: ["src", "allowfullscreen", "allow", "frameborder", "width", "height", "title", "class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { a: ["http", "https", "mailto", "tel", "data"], img: ["http", "https", "data"] },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    transformTags: {
      iframe: (tagName: string, attribs: Record<string, string>): { tagName: string; attribs: Record<string, string> } => {
        const src = youtubeEmbed(attribs.src || "");
        if (!src) return { tagName: "span", attribs: {} };
        const next: Record<string, string> = {
          ...attribs, src, allowfullscreen: "true", title: "Vídeo do YouTube",
        };
        return { tagName, attribs: next };
      },
      a: (tagName: string, attribs: Record<string, string>): { tagName: string; attribs: Record<string, string> } => {
        const href = attribs.href || "";
        if (href.startsWith("data:")) {
          if (!FILE_DATA_URI.test(href) || href.length > MAX_DATA_URI) return { tagName: "span", attribs: {} };
          return { tagName, attribs: { href, target: "_blank", rel: "noopener noreferrer" } };
        }
        const next: Record<string, string> = { ...attribs, rel: "noopener noreferrer" };
        return { tagName, attribs: next };
      },
      img: (tagName: string, attribs: Record<string, string>): { tagName: string; attribs: Record<string, string> } => {
        const src = attribs.src || "";
        if (!src.startsWith("data:")) return { tagName, attribs: { ...attribs } };
        if (!IMAGE_DATA_URI.test(src) || src.length > MAX_DATA_URI) return { tagName: "span", attribs: {} };
        return { tagName, attribs: { src, alt: attribs.alt || "Imagem" } };
      },
    },
  });
}

export function jsonList(value: unknown, label: string): string[] {
  const list = Array.isArray(value) ? value : [];
  if (list.length > 50) throw new Error(`${label} deve ter até 50 itens.`);
  return list.map((item) => httpsUrl(item, label));
}

export interface AttendanceLike {
  sessionId: string;
  personKind: string;
  personId: string;
  status: string;
}

export interface Balance {
  contracted: number;
  consumed: number;
  balance: number;
  pendingMakeups: number;
}

/** Presença e falta Determinísticas: a reposição quita uma aula pendente. */
export function balanceOf(contractedSessions: number, purchasedSessions: number, statuses: string[]): Balance {
  const contracted = Math.max(0, contractedSessions + purchasedSessions);
  let consumed = 0;
  let pendingMakeups = 0;
  for (const status of statuses) {
    if (status === "PRESENT" || status === "ABSENT" || status === "JUSTIFIED") consumed += 1;
    if (status === "MAKEUP") {
      if (pendingMakeups > 0) pendingMakeups -= 1;
      else consumed += 1;
    }
    if (status === "CANCELLED") pendingMakeups += 1;
  }
  return { contracted, consumed, balance: Math.max(0, contracted - consumed), pendingMakeups };
}

export interface AttendanceStats {
  sessions: number;
  present: number;
  absences: number;
  percentage: number;
}

/** Percentual de presença e falta por tipo de pessoa, calculado no servidor. */
export function attendanceStats(records: AttendanceLike[]): { students: AttendanceStats; teachers: AttendanceStats } {
  const summarize = (kind: PersonKind): AttendanceStats => {
    const own = records.filter((record) => record.personKind === kind);
    const sessions = new Set(own.map((record) => record.sessionId)).size;
    const present = own.filter((record) => record.status === "PRESENT" || record.status === "MAKEUP").length;
    const absences = own.filter((record) => record.status === "ABSENT" || record.status === "JUSTIFIED").length;
    const measured = present + absences;
    return { sessions, present, absences, percentage: measured ? Math.round((present / measured) * 100) : 0 };
  };
  return { students: summarize("STUDENT"), teachers: summarize("TEACHER") };
}

export interface BillingPolicy {
  paymentReminderDaysBefore: number;
  remindOnDueDate: boolean;
  remindDailyWhenOverdue: boolean;
  channels: string[];
  consentRequired: boolean;
  teacherReminderMinutesBefore: number;
  cancellationApprovalRequired: boolean;
  overdueInstallmentsForCancellation: number;
  breachPenaltyPercent: number;
  paymentNoticeToManager: boolean;
  paymentNoticeToTeacher: boolean;
  paymentNoticeToAdmins: boolean;
}

export const DEFAULT_BILLING_POLICY: BillingPolicy = {
  paymentReminderDaysBefore: 5,
  remindOnDueDate: true,
  remindDailyWhenOverdue: true,
  channels: ["WHATSAPP", "SMS", "EMAIL"],
  consentRequired: true,
  teacherReminderMinutesBefore: 30,
  cancellationApprovalRequired: false,
  overdueInstallmentsForCancellation: 2,
  breachPenaltyPercent: 20,
  paymentNoticeToManager: true,
  paymentNoticeToTeacher: true,
  paymentNoticeToAdmins: true,
};

/** Multa por quebra: 20% (configurável) sobre total contratado menos o já recebido. */
export function penaltyForBreach(contractTotalCents: number | null, paidCents: number, percent: number): number | null {
  if (contractTotalCents === null) return null;
  const remaining = Math.max(0, contractTotalCents - Math.max(0, paidCents));
  return Math.round((remaining * percent) / 100);
}

/** Período da cobrança que uma baixa em espécime/suprimida deve quitar. */
export function billingPeriodKey(paidDate: string, cycle: string): string | null {
  const date = isoDate(paidDate);
  if (!date) return null;
  if (cycle === "MONTHLY") return date.slice(0, 7);
  if (cycle === "BIWEEKLY") return `${date.slice(0, 7)}-${Number(date.slice(8, 10)) <= 15 ? "H1" : "H2"}`;
  if (cycle === "WEEKLY") {
    const day = new Date(`${date}T00:00:00.000Z`);
    const dayNumber = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - dayNumber + 3);
    const firstThursday = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
    const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
    const week = 1 + Math.round((day.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return null;
}

export interface ReminderOccurrence {
  kind: "BEFORE_DUE" | "DUE_DATE" | "OVERDUE_DAILY";
  scheduledFor: string;
  channels: string[];
}

/** Agenda determinística de lembretes. Nenhum disparo é realizado aqui. */
export function paymentReminderOccurrences(dueDate: string, policy: BillingPolicy, today = new Date()): ReminderOccurrence[] {
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(due.getTime())) return [];
  const current = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const occurrences: ReminderOccurrence[] = [];
  const before = new Date(due);
  before.setUTCDate(before.getUTCDate() - policy.paymentReminderDaysBefore);
  if (before >= current) occurrences.push({ kind: "BEFORE_DUE", scheduledFor: before.toISOString().slice(0, 10), channels: policy.channels });
  if (policy.remindOnDueDate && due >= current) occurrences.push({ kind: "DUE_DATE", scheduledFor: dueDate, channels: policy.channels });
  if (policy.remindDailyWhenOverdue && due < current) {
    for (let day = new Date(due); day < current; day.setUTCDate(day.getUTCDate() + 1)) {
      const scheduledFor = day.toISOString().slice(0, 10);
      if (scheduledFor === dueDate) continue;
      occurrences.push({ kind: "OVERDUE_DAILY", scheduledFor, channels: policy.channels });
    }
  }
  return occurrences;
}

/** Lembrete do professor: 30 minutos antes do início da aula. */
export function teacherReminderAt(sessionDate: string, startTime: string, minutesBefore: number): string | null {
  const date = isoDate(sessionDate);
  if (!date || !TIME.test(startTime)) return null;
  const [hours = 0, minutes = 0] = startTime.split(":").map(Number);
  const moment = new Date(`${date}T00:00:00.000Z`);
  moment.setUTCHours(hours, minutes - minutesBefore, 0, 0);
  return moment.toISOString();
}

export function isManager(role: string): boolean {
  return ["OWNER", "ADMIN", "MANAGER"].includes(role);
}

export function inList<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) throw new Error(`${label} inválido.`);
  return value as T;
}
