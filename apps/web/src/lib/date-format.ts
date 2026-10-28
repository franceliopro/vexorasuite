const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateParts(value: string | Date): [number, number, number] | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return [value.getDate(), value.getMonth() + 1, value.getFullYear()];
  }
  const match = DATE_ONLY.exec(value);
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const check = new Date(year, month - 1, day);
    if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return null;
    return [day, month, year];
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return [parsed.getDate(), parsed.getMonth() + 1, parsed.getFullYear()];
}

export function formatDateBR(value: string | Date | null | undefined): string {
  if (value == null || (typeof value === "string" && value === "")) return "";
  const parts = dateParts(value);
  if (!parts) return String(value);
  const [day, month, year] = parts;
  return String(day).padStart(2, "0") + "/" + String(month).padStart(2, "0") + "/" + String(year).padStart(4, "0");
}

export function formatTimeBR(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return formatDateBR(date) + " " + formatTimeBR(date);
}
