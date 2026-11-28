import { BadRequestException } from "@nestjs/common";

/** Estados exibidos na UI. Nunca transforme PREPARED em "enviado". */
export const ENROLLMENT_STATES = [
  "PREPARED",
  "WAITING_SIGNATURE",
  "SIGNED_CONFIRMED",
  "GENERATED",
  "DELIVERY_FAILED",
  "COMPLETED",
  "FAILED",
] as const;
export type EnrollmentState = (typeof ENROLLMENT_STATES)[number];

export const TEMPLATE_KINDS = ["CONTRACT", "ENROLLMENT_FORM"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const PAYMENT_METHODS = ["BOLETO", "PIX", "CASH", "TRANSFER"] as const;
export const WEEKDAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"] as const;

export const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export function text(value: unknown, max: number, label: string): string {
  if (typeof value !== "string") throw new BadRequestException(`Informe ${label}.`);
  const result = value.trim();
  if (!result) throw new BadRequestException(`Informe ${label}.`);
  if (result.length > max) throw new BadRequestException(`${label} deve ter até ${max} caracteres.`);
  return result;
}

export function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return text(value, max, label);
}

export function inList(value: unknown, list: readonly string[], label: string): string {
  const result = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!list.includes(result)) throw new BadRequestException(`${label} inválido.`);
  return result;
}

export function optionalInList(value: unknown, list: readonly string[], label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return inList(value, list, label);
}

export function integer(value: unknown, min: number, max: number, label: string): number {
  const raw = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
    throw new BadRequestException(`${label} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return raw;
}

export function optionalInteger(value: unknown, min: number, max: number, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  return integer(value, min, max, label);
}

export function isoDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = text(value, 10, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException(`${label} deve estar no formato AAAA-MM-DD.`);
  const parsed = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new BadRequestException(`${label} inválida.`);
  }
  return parsed;
}

export function hhmm(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = text(value, 5, label);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) throw new BadRequestException(`${label} inválido.`);
  return raw;
}

export function httpsUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = text(value, 2000, label);
  let url: URL;
  try { url = new URL(raw); } catch { throw new BadRequestException(`${label} deve ser uma URL válida.`); }
  if (url.protocol !== "https:" || url.username || url.password) throw new BadRequestException(`${label} deve usar HTTPS sem credenciais.`);
  return raw;
}

export function phone(value: unknown, label: string): string | null {
  const raw = optionalText(value, 40, label);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) throw new BadRequestException(`${label} inválido.`);
  return raw;
}

export function cpf(value: unknown, label: string): string | null {
  const raw = optionalText(value, 20, label);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) throw new BadRequestException(`${label} deve conter 11 dígitos.`);
  return digits;
}

export function variablesOf(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(/\{\{([a-z0-9_]{1,40})\}\}/gi)) {
    const key = String(match[1]).toLowerCase();
    if (KEY_RE.test(key)) found.add(key);
  }
  return [...found];
}

export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderVariables(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{([a-z0-9_]{1,40})\}\}/gi, (_, key: string) => values[String(key).toLowerCase()] ?? "");
}

export function enrollmentValues(input: {
  tenantName: string;
  ownerName: string;
  studentName: string;
  studentCpf?: string | null;
  studentEmail?: string | null;
  studentPhone?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  addressLine?: string | null;
  courseName?: string | null;
  courseLevel?: string | null;
  teacherName?: string | null;
  instrument?: string | null;
  startDate?: string | null;
  weekdayLabel?: string | null;
  startTime?: string | null;
  periodLabel?: string | null;
  contractPeriodLabel?: string | null;
  tuitionAmountCents?: number | null;
  paymentMethod?: string | null;
  observations?: string | null;
}): Record<string, string> {
  const money = typeof input.tuitionAmountCents === "number"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.tuitionAmountCents / 100)
    : "";
  return {
    escola: input.tenantName,
    professor: input.teacherName || input.ownerName,
    nome_aluno: input.studentName,
    cpf_aluno: input.studentCpf || "",
    email_aluno: input.studentEmail || "",
    telefone_aluno: input.studentPhone || "",
    responsavel: input.guardianName || "",
    telefone_responsavel: input.guardianPhone || "",
    email_responsavel: input.guardianEmail || "",
    endereco: input.addressLine || "",
    curso: input.courseName || "",
    nivel: input.courseLevel || input.instrument || "",
    instrumento: input.instrument || "",
    data_inicio: input.startDate || "",
    dia_semana: input.weekdayLabel || "",
    horario: input.startTime || "",
    periodo: input.periodLabel || "",
    periodo_contratual: input.contractPeriodLabel || "",
    mensalidade: money,
    forma_pagamento: input.paymentMethod || "",
    observacoes: input.observations || "",
  };
}
