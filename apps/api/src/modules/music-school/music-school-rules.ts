import { BadRequestException } from "@nestjs/common";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const OUTCOMES = ["ATTENDED", "STUDENT_ABSENT", "TEACHER_ABSENT", "CANCELLED", "MAKEUP"] as const;
export type Outcome = (typeof OUTCOMES)[number];
const CONSUMING: readonly string[] = ["ATTENDED", "STUDENT_ABSENT", "MAKEUP"];
const PENDING: readonly string[] = ["TEACHER_ABSENT", "CANCELLED"];

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
export const isManager = (role: string) => ["OWNER", "ADMIN", "MANAGER"].includes(role);
export const text = (value: unknown, max: number): string => typeof value === "string" ? value.trim().slice(0, max) : "";
export const integer = (value: unknown, min: number, max: number, label: string): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new BadRequestException(`${label} deve ser um inteiro entre ${min} e ${max}.`);
  return parsed;
};
export const optionalInteger = (value: unknown, min: number, max: number, label: string): number | null => {
  if (value === undefined || value === null || value === "") return null;
  return integer(value, min, max, label);
};
export const isoDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
};
export const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** ATTENDED, STUDENT_ABSENT e MAKEUP consomem; TEACHER_ABSENT e CANCELLED geram reposição. */
export function balanceOf(contracted: number, purchased: number, outcomes: readonly string[]) {
  const consumed = outcomes.filter((outcome) => CONSUMING.includes(outcome)).length;
  const pendingCount = outcomes.filter((outcome) => PENDING.includes(outcome)).length;
  const makeupCount = outcomes.filter((outcome) => outcome === "MAKEUP").length;
  const total = contracted + purchased;
  return { contracted: total, consumed, balance: Math.max(0, total - consumed), pendingMakeups: Math.max(0, pendingCount - makeupCount) };
}