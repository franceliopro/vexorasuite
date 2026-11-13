/** Máscaras e parse de valores monetários em pt-BR (ex.: "1.220.345,56"). */

export function parseBRL(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.abs(raw);
  const s = String(raw).replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  // "1.220.345,56" | "1220345,56" | "1220345.56" | "1.220,50"
  const hasComma = s.includes(",");
  const normalized = hasComma ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

export function formatBRL(value: unknown, withSymbol = true): string {
  const n = typeof value === "number" ? value : parseBRL(value);
  if (n === null) return withSymbol ? "R$ 0,00" : "0,00";
  return withSymbol
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Máscara enquanto digita: mantém só dígitos e mostra os centavos certos. */
export function maskBRLInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const trimmed = digits.slice(0, 13);
  const n = Number(trimmed) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Normaliza para o formato canônico "R$ 1.220.345,56" quando possível; senão devolve o texto cru. */
export function normalizePrice(raw: unknown): string {
  const n = parseBRL(raw);
  if (n === null) return typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
