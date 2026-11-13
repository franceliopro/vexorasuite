/** Normalização de preço em pt-BR (espelha apps/web/src/lib/money.ts). */

export function parseBRL(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.abs(raw);
  const s = String(raw).replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  const hasComma = s.includes(",");
  const normalized = hasComma ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

export function normalizePrice(raw: unknown): string {
  const n = parseBRL(raw);
  if (n === null) return typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
