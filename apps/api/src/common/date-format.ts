const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function formatDateBR(value: string | Date | null | undefined, timeZone = "America/Sao_Paulo"): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const match = DATE_ONLY.exec(value);
    if (match) {
      const [, yearText, monthText, dayText] = match;
      const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
      if (date.getUTCFullYear() !== Number(yearText) || date.getUTCMonth() !== Number(monthText) - 1 || date.getUTCDate() !== Number(dayText)) return value;
      return dayText + "/" + monthText + "/" + yearText;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeBR(value: string | Date | null | undefined, timeZone = "America/Sao_Paulo"): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function parseBrazilianDate(value: string): string | null {
  const match = DATE_BR.exec(value);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return yearText + "-" + monthText + "-" + dayText;
}

export function formatMonthBR(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match ? match[2] + "/" + match[1] : value;
}
