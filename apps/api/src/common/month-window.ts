/** Janela do mês corrente no fuso de São Paulo (calendário comercial "deste mês"). */
export function monthWindowSaoPaulo(): { month: string; start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" });
  const month = fmt.format(new Date()); // YYYY-MM
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 2026;
  const monthNum = parts[1] ?? 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = monthNum === 12 ? `${year + 1}-01` : `${year}-${pad(monthNum + 1)}`;
  return { month, start: new Date(`${month}-01T00:00:00-03:00`), end: new Date(`${next}-01T00:00:00-03:00`) };
}
