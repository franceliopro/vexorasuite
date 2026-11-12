"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CircleAlert,
  FileDown,
  LayoutDashboard,
  MessagesSquare,
  Printer,
  RefreshCw,
  Sparkles,
  Target,
  UsersRound,
  Wallet,
} from "lucide-react";
import { formatDateBR } from "../lib/date-format";

/* ================================================================== */
/* Tipos das APIs consumidas                                           */
/* ================================================================== */
type Summary = {
  total: number; open: number; pending: number; resolved: number; closed: number;
  bot: number; human: number; contacts: number; messages: number;
  firstMessageSeconds: number | null; firstMessageSample: number; finished: number;
};
type Group = { id: string; name: string; total: number; open: number; pending: number; finished: number; bot: number; human: number };
type ServiceReport = {
  period: { from: string; to: string };
  comparisonPeriod: { from: string; to: string };
  summary: Summary;
  comparison?: Summary;
  byChannel: Group[];
  byAgent: Group[];
  byDepartment: Group[];
  basis?: string;
};
type OverviewApi = {
  openConversations?: number;
  completedConversations?: number;
  contacts?: number;
  contactsNewWeek?: number;
  activeAgents?: number;
  agentsTotal?: number;
  hourly?: { labels: string[]; values: number[]; peakIndex: number | null; peakValue: number } | null;
  topics?: Array<{ label: string; count: number; percent: number; channel?: string }> | null;
  kpis?: {
    resolvedByAi?: number;
    resolvedByAiPercent?: number;
    revenue?: number;
    payments?: number;
    firstResponseSeconds?: number | null;
  } | null;
};
type ExecutiveSeriesPoint = { month: string; billed: number; paid: number; open: number; overdue: number };
type Executive = {
  source?: string;
  environment?: string;
  from?: string;
  to?: string;
  months?: number;
  totals: { billed: number; paid: number; open: number; overdue: number; count: number; overdueCount: number; customers: number };
  collectionRate: number | null;
  series: ExecutiveSeriesPoint[];
  byStatus: Array<{ status: string; count: number; amount: number }>;
  byBillingType: Array<{ type: string; count: number; amount: number }>;
};
type PipelineStage = { id?: string; label?: string; tone?: string; count?: unknown; cards?: unknown };
type CrmPipeline = {
  id: string;
  name: string;
  template?: string;
  stages?: PipelineStage[] | unknown;
  department?: { id: string; name: string } | null;
};
type CrmPipelinesPayload = { pipelines?: CrmPipeline[] };
type OriginGroup = { name: string; total: number; won: number; lost: number; open: number; withCampaign: number };
type LeadOrigins = {
  total: number;
  identified: number;
  unidentified: number;
  byOrigin?: OriginGroup[];
  stages?: Array<{ name: string; count: number }>;
  basis?: string;
};

const TABS = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "service", label: "Atendimento", icon: MessagesSquare },
  { id: "team", label: "Equipe", icon: UsersRound },
  { id: "crm", label: "CRM / Vendas", icon: Target },
  { id: "finance", label: "Financeiro", icon: Wallet },
  { id: "ai", label: "IA & Automação", icon: Sparkles },
] as const;
type TabKey = (typeof TABS)[number]["id"];
function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TABS as readonly { id: string }[]).some((tab) => tab.id === value);
}
function tabLabel(tab: TabKey): string {
  return TABS.find((item) => item.id === tab)?.label ?? "Relatórios";
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
const DAY = 86400000;
function dateValue(value: Date): string {
  return value.getFullYear() + "-" + String(value.getMonth() + 1).padStart(2, "0") + "-" + String(value.getDate()).padStart(2, "0");
}
function shiftDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY);
}
const numberBR = (value: number) => value.toLocaleString("pt-BR");
const currencyBRL = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const compactBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const csvNumber = (value: number | null | undefined) => (value == null ? "" : String(value).replace(".", ","));
function durationFromSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "Sem base";
  if (seconds < 60) return Math.round(seconds) + " s";
  if (seconds < 3600) return Math.round(seconds / 60) + " min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours + " h " + String(minutes).padStart(2, "0") + " min";
}
function deltaPercent(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
function deltaLabel(delta: number | null, suffix = "%"): string {
  if (delta === null) return "Sem base";
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return sign + Math.abs(delta).toFixed(1).replace(".", ",") + suffix;
}
function deltaTone(delta: number | null, invert = false): "up" | "down" | "flat" {
  if (delta === null || delta === 0) return "flat";
  const positive = delta > 0;
  return invert ? (positive ? "down" : "up") : positive ? "up" : "down";
}
function shortMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;
  const year = Number(match[1] ?? "0");
  const monthIndex = Number(match[2] ?? "1") - 1;
  const date = new Date(year, monthIndex, 1);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") + "/" + String(year).slice(2);
}
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as { message?: string } & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(data.message || "Não foi possível carregar os dados (HTTP " + response.status + ").");
  }
  return data as unknown as T;
}

type SectionState<T> = { data: T | null; loading: boolean; error: string };
function useSection<T>(load: () => Promise<T>, enabled: boolean, deps: readonly unknown[]): SectionState<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SectionState<T>>({ data: null, loading: enabled, error: "" });
  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: "" });
      return;
    }
    let live = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    load()
      .then((data) => { if (live) setState({ data, loading: false, error: "" }); })
      .catch((error) => {
        if (live) setState({ data: null, loading: false, error: error instanceof Error ? error.message : "Não foi possível carregar esta seção." });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

const STATUS_BR: Record<string, string> = {
  PENDING: "Pendente", OVERDUE: "Vencido", RECEIVED: "Recebido", CONFIRMED: "Confirmado",
  RECEIVED_IN_CASH: "Recebido em dinheiro", REFUNDED: "Estornado", CANCELLED: "Cancelado",
  CHARGEBACK_REQUESTED: "Contestação solicitada", CHARGEBACK_DISPUTE: "Em contestação",
};
const BILLING_BR: Record<string, string> = {
  BOLETO: "Boleto", PIX: "Pix", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito",
  UNDEFINED: "Não informado", OTHER: "Outro", DEPOSIT: "Depósito", TRANSFER: "Transferência", PAYMENT_ORDER: "Ordem de pagamento",
};
const TONE_COLOR: Record<string, string> = {
  violet: "#8B5CF6", blue: "#3B82F6", amber: "#F59E0B", green: "#10B981", rose: "#F43F5E", pink: "#EC4899",
  cyan: "#22D3EE", orange: "#F97316", lilac: "#C084FC", lime: "#84CC16", fuchsia: "#D946EF", teal: "#14B8A6",
};
/* Paleta diversificada — vizinhos sempre distantes */
const CHART_PALETTE = ["#8B5CF6", "#F59E0B", "#22D3EE", "#F43F5E", "#10B981", "#3B82F6", "#EC4899", "#FB7185", "#84CC16", "#C084FC", "#F97316", "#FDE047"];
const STAGE_FALLBACK = ["#8B5CF6", "#22D3EE", "#F43F5E", "#F59E0B", "#10B981", "#EC4899", "#3B82F6", "#C084FC", "#F97316", "#84CC16"];
const networkColor = (label: string): string | null => {
  const v = label.toLowerCase();
  if (v.includes("instagram")) return "url(#rw-instagram)";
  if (v.includes("facebook") || v.includes("meta")) return "#1877F2";
  if (v.includes("whatsapp")) return "#25D366";
  if (v.includes("tiktok")) return "#111111";
  if (v.includes("linkedin")) return "#0A66C2";
  if (v.includes("google") || v.includes("gmail")) return "#4285F4";
  if (v.includes("email") || v.includes("e-mail")) return "#0EA5E9";
  if (v.includes("landing") || v.includes("site")) return "#8B5CF6";
  if (v.includes("form") || v.includes("formul")) return "#E9A13B";
  return null;
};
const barColor = (label: string, index: number): string => networkColor(label) ?? CHART_PALETTE[index % CHART_PALETTE.length] ?? "#2E7CF6";

/* ================================================================== */
/* Blocos visuais                                                      */
/* ================================================================== */
function Delta({ value, invert = false, suffix = "%" }: { value: number | null; invert?: boolean; suffix?: string }) {
  const tone = deltaTone(value, invert);
  const arrow = value === null || value === 0 ? "–" : value > 0 ? "▲" : "▼";
  return (
    <span className={"rw-delta " + tone} title={value === null ? "Sem base de comparação" : "Variação vs. período anterior"}>
      <span aria-hidden="true">{arrow}</span> {deltaLabel(value, suffix)}
    </span>
  );
}
function Kpi({ label, value, note, delta, invert, suffix }: { label: string; value: ReactNode; note?: string; delta?: number | null; invert?: boolean; suffix?: string }) {
  return (
    <div className="rw-card rw-kpi">
      <span className="rw-kpi-label">{label}</span>
      <strong className="rw-kpi-value">{value}</strong>
      <div className="rw-kpi-foot">
        {delta !== undefined ? <Delta value={delta} invert={invert} suffix={suffix} /> : null}
        {note ? <small className="rw-kpi-note">{note}</small> : null}
      </div>
    </div>
  );
}
function PanelSkeleton() {
  return (
    <div className="rw-skeleton" aria-busy="true" role="status" aria-label="Carregando indicadores">
      <div className="rw-skel-grid">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="rw-skel rw-skel-card" />)}
      </div>
      <div className="rw-skel rw-skel-chart" />
      <div className="rw-skel rw-skel-chart rw-skel-chart-short" />
    </div>
  );
}
function SectionError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="rw-error" role="alert">
      <CircleAlert size={26} strokeWidth={1.6} aria-hidden="true" />
      <div className="rw-error-body">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="rw-btn rw-btn-ghost" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
      </button>
    </div>
  );
}
function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rw-empty">
      <CircleAlert size={22} strokeWidth={1.6} aria-hidden="true" />
      <strong>{title}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}
function CardHead({ title, hint, aside }: { title: string; hint?: string; aside?: ReactNode }) {
  return (
    <div className="rw-card-head">
      <div>
        <h3 className="rw-card-title">{title}</h3>
        {hint ? <p className="rw-card-hint">{hint}</p> : null}
      </div>
      {aside ? <div className="rw-card-aside">{aside}</div> : null}
    </div>
  );
}
function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="rw-table-wrap">
      <table className="rw-table">
        <caption className="rw-visually-hidden">{caption}</caption>
        <thead>
          <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={columns.length} className="rw-table-empty">Sem registros para este período.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function HorizontalBars({ rows, format }: { rows: Array<{ label: string; value: number; fill?: string }>; format?: (value: number) => string }) {
  const visible = rows.slice(0, 8);
  const max = Math.max(1, ...visible.map((row) => row.value));
  const render = format ?? numberBR;
  if (!visible.length) return <EmptyBlock title="Sem dados para exibir" hint="Nenhum registro encontrado no período selecionado." />;
  return (
    <div className="rw-hbars">
      {visible.map((row, index) => {
        const width = Math.max(row.value > 0 ? 3 : 0, (row.value / max) * 100);
        const fill = row.fill ?? barColor(row.label, index);
        return (
          <div className="rw-hbar-row" key={row.label}>
            <span className="rw-hbar-label" title={row.label}>{row.label}</span>
            <svg className="rw-hbar-track" viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label={row.label + ": " + render(row.value)}>
              <rect x="0" y="0" width="100" height="12" rx="6" className="rw-hbar-bg" />
              {row.value > 0 ? <rect x="0" y="0" width={width} height="12" rx="6" className="rw-hbar-fill" style={{ fill }} /> : null}
            </svg>
            <span className="rw-hbar-value">{render(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
function Donut({ segments, totalLabel }: { segments: Array<{ label: string; value: number; color: string }>; totalLabel: string }) {
  const size = 132;
  const thickness = 17;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;
  return (
    <div className="rw-donut-wrap">
      <svg className="rw-donut" viewBox={"0 0 " + size + " " + size} role="img" aria-label={"Distribuição: " + segments.map((segment) => segment.label + " " + segment.value).join(", ")}>
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={thickness} className="rw-donut-track" />
        {total > 0 && segments.map((segment) => {
          if (segment.value <= 0) return null;
          const fraction = segment.value / total;
          const dash = fraction * circumference;
          const element = (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={thickness}
              strokeDasharray={dash.toFixed(2) + " " + (circumference - dash).toFixed(2)}
              strokeDashoffset={(-offset).toFixed(2)}
              transform={"rotate(-90 " + center + " " + center + ")"}
              style={{ stroke: segment.color }}
            >
              <title>{segment.label + ": " + segment.value}</title>
            </circle>
          );
          offset += dash;
          return element;
        })}
        <text x={center} y={center - 1} textAnchor="middle" className="rw-donut-total">{numberBR(total)}</text>
        <text x={center} y={center + 14} textAnchor="middle" className="rw-donut-caption">{totalLabel}</text>
      </svg>
      <ul className="rw-legend">
        {segments.map((segment) => (
          <li key={segment.label} className="rw-legend-item">
            <span className="rw-legend-dot" style={{ background: segment.color }} aria-hidden="true" />
            <span className="rw-legend-label">{segment.label}</span>
            <strong className="rw-legend-value">{numberBR(segment.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
function FinanceLine({ series }: { series: ExecutiveSeriesPoint[] }) {
  const width = 720;
  const height = 196;
  const padLeft = 52;
  const padRight = 10;
  const padTop = 16;
  const padBottom = 30;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const max = Math.max(10, ...series.flatMap((point) => [point.billed, point.paid]));
  const x = (index: number) => padLeft + (series.length <= 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth);
  const y = (value: number) => padTop + innerHeight - (value / max) * innerHeight;
  const lineFor = (key: "billed" | "paid") =>
    series.map((point, index) => (index === 0 ? "M" : "L") + x(index).toFixed(1) + "," + y(point[key]).toFixed(1)).join(" ");
  const billedPath = series.length ? lineFor("billed") : "";
  const paidPath = series.length ? lineFor("paid") : "";
  const areaPath = series.length
    ? billedPath + " L" + x(series.length - 1).toFixed(1) + "," + y(0).toFixed(1) + " L" + x(0).toFixed(1) + "," + y(0).toFixed(1) + " Z"
    : "";
  const gridFractions = [0, 1 / 3, 2 / 3, 1];
  if (!series.length) return <EmptyBlock title="Sem série mensal" hint="Nenhuma cobrança encontrada para o período." />;
  return (
    <div className="rw-linechart">
      <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label="Evolução mensal de faturado e recebido">
        {gridFractions.map((fraction) => {
          const gy = y(max * fraction);
          return (
            <g key={fraction}>
              <line x1={padLeft} y1={gy} x2={width - padRight} y2={gy} className="rw-gridline" />
              <text x={padLeft - 8} y={gy + 3} textAnchor="end" className="rw-ylabel">{compactBRL(max * fraction)}</text>
            </g>
          );
        })}
        {areaPath ? <path d={areaPath} className="rw-line-area" /> : null}
        {paidPath ? <path d={paidPath} className="rw-line-paid" fill="none" /> : null}
        {billedPath ? <path d={billedPath} className="rw-line-billed" fill="none" /> : null}
        {series.map((point, index) => (
          <g key={point.month}>
            <circle cx={x(index)} cy={y(point.billed)} r={3} className="rw-dot-billed"><title>{shortMonth(point.month) + " · Faturado: " + currencyBRL(point.billed)}</title></circle>
            <circle cx={x(index)} cy={y(point.paid)} r={3} className="rw-dot-paid"><title>{shortMonth(point.month) + " · Recebido: " + currencyBRL(point.paid)}</title></circle>
            <text x={x(index)} y={height - 10} textAnchor="middle" className="rw-xlabel">{shortMonth(point.month)}</text>
          </g>
        ))}
      </svg>
      <div className="rw-linechart-legend">
        <span><i className="rw-legend-dot rw-dot-billed" aria-hidden="true" /> Faturado</span>
        <span><i className="rw-legend-dot rw-dot-paid" aria-hidden="true" /> Recebido</span>
      </div>
    </div>
  );
}
function HourlyBars({ labels, values, peakIndex }: { labels: string[]; values: number[]; peakIndex: number | null }) {
  const width = 720;
  const height = 118;
  const baseline = 96;
  const max = Math.max(1, ...values);
  const slot = width / Math.max(1, values.length);
  return (
    <svg className="rw-hourly" viewBox={"0 0 " + width + " " + height} role="img" aria-label="Volume de conversas por hora nas últimas 24 horas">
      {values.map((value, index) => {
        const barHeight = (value / max) * 78;
        const isPeak = peakIndex === index && value > 0;
        return (
          <rect
            key={index}
            x={index * slot + slot * 0.18}
            y={baseline - barHeight}
            width={Math.max(2, slot * 0.64)}
            height={barHeight}
            rx={1.6}
            className={isPeak ? "rw-hour-peak" : "rw-hour-bar"}
          >
            <title>{(labels[index] ?? String(index) + "h") + ": " + value + " conversas"}</title>
          </rect>
        );
      })}
      <line x1={0} y1={baseline} x2={width} y2={baseline} className="rw-gridline" />
      {[0, 6, 12, 18].map((hour) => (
        <text key={hour} x={hour * slot + slot / 2} y={height - 2} textAnchor="middle" className="rw-xlabel">{String(hour).padStart(2, "0") + "h"}</text>
      ))}
    </svg>
  );
}

/* CSV ------------------------------------------------------------------ */
type CsvRow = Array<string | number>;
function csvCell(value: string | number): string {
  return '"' + String(value).replace(/"/g, '""') + '"';
}
function downloadCsv(filename: string, rows: CsvRow[]) {
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ================================================================== */
/* Componente principal                                                 */
/* ================================================================== */
const PRESETS = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "Últimos 90 dias" },
  { id: "custom", label: "Personalizado" },
] as const;
type PresetId = (typeof PRESETS)[number]["id"];
function presetRange(preset: Exclude<PresetId, "custom">): { from: string; to: string } {
  const today = new Date();
  const days = preset === "today" ? 0 : preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
  return { from: dateValue(shiftDays(today, -days)), to: dateValue(today) };
}

function ReportsWorkspaceInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "overview";
  const setTab = (next: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  };

  const [preset, setPreset] = useState<PresetId>("30d");
  const [from, setFrom] = useState(() => dateValue(shiftDays(new Date(), -29)));
  const [to, setTo] = useState(() => dateValue(new Date()));
  const [customError, setCustomError] = useState("");
  const [applied, setApplied] = useState(() => ({ from: dateValue(shiftDays(new Date(), -29)), to: dateValue(new Date()) }));

  function selectPreset(next: PresetId) {
    setPreset(next);
    setCustomError("");
    if (next === "custom") return;
    const range = presetRange(next);
    setFrom(range.from);
    setTo(range.to);
    setApplied(range);
  }
  function applyCustomRange() {
    if (!from || !to) { setCustomError("Informe as duas datas do período."); return; }
    if (from > to) { setCustomError("A data inicial não pode ser posterior à data final."); return; }
    setCustomError("");
    setApplied({ from, to });
  }

  // Mesma convenção do restante do app: getTimezoneOffset cru, que o backend soma em minutos à meia-noite UTC.
  const tzOffset = String(new Date().getTimezoneOffset());
  const serviceQuery = new URLSearchParams({ from: applied.from, to: applied.to, tzOffset }).toString();
  const originsQuery = new URLSearchParams({ from: applied.from, to: applied.to, tzOffset }).toString();
  const financeQuery = new URLSearchParams({ months: "12", from: applied.from, to: applied.to }).toString();

  const serviceSection = useSection(() => fetchJson<ServiceReport>("/api/backend/reports/service?" + serviceQuery), true, [applied.from, applied.to]);
  const overviewSection = useSection(() => fetchJson<OverviewApi>("/api/backend/overview"), tab === "ai", [tab]);
  const financeSection = useSection(() => fetchJson<Executive>("/api/backend/finance/executive?" + financeQuery), tab === "finance", [applied.from, applied.to, tab]);
  const pipelinesSection = useSection(() => fetchJson<CrmPipelinesPayload>("/api/backend/crm/pipelines"), tab === "crm", [tab]);
  const originsSection = useSection(() => fetchJson<LeadOrigins>("/api/backend/reports/lead-origins?" + originsQuery), tab === "crm", [applied.from, applied.to, tab]);

  const refreshAll = () => {
    serviceSection.retry();
    overviewSection.retry();
    financeSection.retry();
    pipelinesSection.retry();
    originsSection.retry();
  };

  const periodLabel = formatDateBR(applied.from) + " a " + formatDateBR(applied.to);
  const service = serviceSection.data;
  const comparisonLabel = service
    ? "Comparado com " + formatDateBR(service.comparisonPeriod.from) + " a " + formatDateBR(service.comparisonPeriod.to)
    : "Comparado com o período anterior";
  const generatedLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const summary = service?.summary ?? null;
  const comparison = service?.comparison ?? null;
  const finishRate = summary && summary.total > 0 ? (summary.finished / summary.total) * 100 : null;
  const previousFinishRate = comparison && comparison.total > 0 ? (comparison.finished / comparison.total) * 100 : null;
  const finishRateDelta = finishRate !== null && previousFinishRate !== null ? finishRate - previousFinishRate : null;
  const composition = summary
    ? [
        { label: "Humano", value: summary.human, color: "var(--primary)" },
        { label: "IA / Bot", value: summary.bot, color: "#8B5CF6" },
        { label: "Sem modo registrado", value: Math.max(0, summary.total - summary.human - summary.bot), color: "var(--ln2)" },
      ]
    : [];

  function buildCsv(): { filename: string; rows: CsvRow[] } {
    const rows: CsvRow[] = [];
    rows.push(["Véxora Suite · Relatórios"]);
    rows.push(["Seção", tabLabel(tab)]);
    rows.push(["Período", applied.from, "a", applied.to]);
    rows.push(["Comparado com", service ? service.comparisonPeriod.from : "", "a", service ? service.comparisonPeriod.to : ""]);
    rows.push(["Gerado em", new Date().toLocaleString("pt-BR")]);
    rows.push([]);

    const pushServiceSummary = () => {
      if (!summary) { rows.push(["Atendimento", "Seção indisponível", serviceSection.error || "Sem dados"]); return; }
      rows.push(["Indicador", "Atual", "Anterior", "Variação %"]);
      const line = (label: string, current: number | null, previous: number | null) => {
        const delta = deltaPercent(current, previous);
        rows.push([label, current ?? "", previous ?? "", delta === null ? "Sem base" : delta.toFixed(1).replace(".", ",") + "%"]);
      };
      line("Conversas", summary.total, comparison?.total ?? null);
      line("Finalizadas", summary.finished, comparison?.finished ?? null);
      line("Em aberto", summary.open, comparison?.open ?? null);
      line("Pendentes", summary.pending, comparison?.pending ?? null);
      line("Resolvidas", summary.resolved, comparison?.resolved ?? null);
      line("Contatos únicos", summary.contacts, comparison?.contacts ?? null);
      line("Mensagens registradas", summary.messages, comparison?.messages ?? null);
      line("Atendidas por IA / bot", summary.bot, comparison?.bot ?? null);
      line("Atendidas por humano", summary.human, comparison?.human ?? null);
      rows.push(["Primeira resposta (segundos)", summary.firstMessageSeconds ?? "", comparison?.firstMessageSeconds ?? "", ""]);
      if (finishRate !== null) rows.push(["Taxa de finalização %", csvNumber(finishRate), previousFinishRate === null ? "" : csvNumber(previousFinishRate), ""]);
    };
    const pushGroupTable = (title: string, groups: Group[]) => {
      rows.push([]);
      rows.push([title]);
      rows.push(["Grupo", "Total", "Abertas", "Pendentes", "Finalizadas", "IA / Bot", "Humano"]);
      for (const group of groups) rows.push([group.name, group.total, group.open, group.pending, group.finished, group.bot, group.human]);
    };

    if (tab === "overview" || tab === "service") {
      pushServiceSummary();
      if (service) {
        pushGroupTable("Volume por canal", service.byChannel);
        if (tab === "service") pushGroupTable("Por atendente", service.byAgent);
      }
    } else if (tab === "team") {
      if (!service) {
        rows.push(["Equipe", "Seção indisponível", serviceSection.error || "Sem dados"]);
      } else {
        rows.push(["Equipe", "Atendentes", service.byAgent.length, "Setores", service.byDepartment.length]);
        pushGroupTable("Por atendente", service.byAgent);
        pushGroupTable("Por setor", service.byDepartment);
      }
    } else if (tab === "crm") {
      const origins = originsSection.data;
      if (!origins) {
        rows.push(["CRM / Vendas", "Origens indisponíveis", originsSection.error || "Sem dados"]);
      } else {
        rows.push(["Leads no período", origins.total]);
        rows.push(["Identificados", origins.identified]);
        rows.push(["Não identificados", origins.unidentified]);
        rows.push([]);
        rows.push(["Origem", "Leads", "Ganhos", "Perdas", "Em aberto", "Com campanha"]);
        for (const origin of origins.byOrigin ?? []) {
          rows.push([origin.name, origin.total, origin.won, origin.lost, origin.open, origin.withCampaign]);
        }
        if (origins.stages?.length) {
          rows.push([]);
          rows.push(["Etapa do funil", "Leads"]);
          for (const stage of origins.stages) rows.push([stage.name, stage.count]);
        }
      }
      const pipelines = pipelinesSection.data?.pipelines ?? [];
      rows.push([]);
      rows.push(["Pipelines e etapas"]);
      for (const pipeline of pipelines) {
        const stages = Array.isArray(pipeline.stages) ? (pipeline.stages as PipelineStage[]) : [];
        rows.push([pipeline.name, pipeline.department?.name ?? "Sem setor", stages.map((stage) => stage.label ?? stage.id ?? "").filter(Boolean).join(" → ")]);
      }
    } else if (tab === "finance") {
      const finance = financeSection.data;
      if (!finance) {
        rows.push(["Financeiro", "Seção indisponível", financeSection.error || "Sem dados"]);
      } else {
        rows.push(["Total faturado (R$)", csvNumber(finance.totals.billed)]);
        rows.push(["Total recebido (R$)", csvNumber(finance.totals.paid)]);
        rows.push(["Em aberto (R$)", csvNumber(finance.totals.open)]);
        rows.push(["Vencido (R$)", csvNumber(finance.totals.overdue)]);
        rows.push(["Cobranças", finance.totals.count]);
        rows.push(["Cobranças vencidas", finance.totals.overdueCount]);
        rows.push(["Clientes", finance.totals.customers]);
        rows.push(["Taxa de recebimento %", finance.collectionRate === null ? "Sem base" : csvNumber(finance.collectionRate)]);
        rows.push([]);
        rows.push(["Mês", "Faturado (R$)", "Recebido (R$)", "Em aberto (R$)", "Vencido (R$)"]);
        for (const point of finance.series) {
          rows.push([point.month, csvNumber(point.billed), csvNumber(point.paid), csvNumber(point.open), csvNumber(point.overdue)]);
        }
        rows.push([]);
        rows.push(["Situação", "Cobranças", "Valor (R$)"]);
        for (const row of finance.byStatus) rows.push([STATUS_BR[row.status] ?? row.status, row.count, csvNumber(row.amount)]);
        rows.push([]);
        rows.push(["Forma de pagamento", "Cobranças", "Valor (R$)"]);
        for (const row of finance.byBillingType) rows.push([BILLING_BR[row.type] ?? row.type, row.count, csvNumber(row.amount)]);
      }
    } else if (tab === "ai") {
      const overview = overviewSection.data;
      const kpis = overview?.kpis;
      if (!overview || !kpis) {
        rows.push(["IA & Automação", "Indicadores indisponíveis", overviewSection.error || "Sem dados"]);
      } else {
        rows.push(["Resolvidas pela IA", kpis.resolvedByAi ?? ""]);
        rows.push(["% resolvidas pela IA", kpis.resolvedByAiPercent ?? ""]);
        rows.push(["Conversas concluídas", overview.completedConversations ?? ""]);
        rows.push(["Conversas em aberto", overview.openConversations ?? ""]);
        rows.push(["Receita de pagamentos (R$)", csvNumber(kpis.revenue ?? 0)]);
        rows.push(["Pagamentos no período", kpis.payments ?? ""]);
        rows.push(["Primeira resposta (segundos)", kpis.firstResponseSeconds ?? ""]);
        rows.push(["Agentes ativos", overview.activeAgents ?? ""]);
        rows.push(["Agentes configurados", overview.agentsTotal ?? ""]);
        if (overview.topics?.length) {
          rows.push([]);
          rows.push(["Tema", "Conversas", "%"]);
          for (const topic of overview.topics) rows.push([topic.label, topic.count, topic.percent]);
        }
      }
    }
    return { filename: "vexora-relatorios-" + applied.from + "_a_" + applied.to + ".csv", rows };
  }

  const exportCsv = () => {
    const { filename, rows } = buildCsv();
    downloadCsv(filename, rows);
  };

  const topAgent = service?.byAgent?.[0] ?? null;

  return (
    <div className="reports-print-root">
      <style>{REPORTS_CSS}</style>

      {/* Capa institucional — somente impressão */}
      <div className="rw-print-cover reports-print-only" aria-hidden="true">
        <span className="rw-print-mark">V</span>
        <span className="rw-print-text">
          <strong>{"Véxora Suite · Relatórios · " + periodLabel}</strong>
          <small>{"Emitido em " + generatedLabel + " · " + comparisonLabel}</small>
        </span>
      </div>

      {/* Barra superior — somente tela */}
      <div className="rw-top reports-no-print">
        <div className="rw-head-left">
          <span className="rw-badge">Véxora Suite</span>
          <h1>Relatórios</h1>
          <p className="rw-sub">Indicadores executivos de atendimento, equipe, vendas, financeiro e automação.</p>
        </div>
        <div className="rw-actions">
          <button type="button" className="rw-btn rw-btn-ghost" onClick={refreshAll} title="Recarregar todos os indicadores">
            <RefreshCw size={15} aria-hidden="true" /> Atualizar
          </button>
          <button type="button" className="rw-btn rw-btn-ghost" onClick={() => window.print()} title="Gera o PDF pela impressão do navegador">
            <Printer size={15} aria-hidden="true" /> Baixar PDF
          </button>
          <button type="button" className="rw-btn rw-btn-primary" onClick={exportCsv} title="Exporta a seção ativa em CSV (Excel)">
            <FileDown size={15} aria-hidden="true" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtro de período — somente tela */}
      <div className="rw-period reports-no-print">
        <div className="rw-presets" role="group" aria-label="Selecionar período">
          {PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={"rw-chip" + (preset === option.id ? " active" : "")}
              aria-pressed={preset === option.id}
              onClick={() => selectPreset(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="rw-custom">
            <label>De<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
            <label>Até<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
            <button type="button" className="rw-btn rw-btn-ghost" onClick={applyCustomRange}>Aplicar</button>
            {customError ? <small className="rw-custom-error" role="alert">{customError}</small> : null}
          </div>
        ) : null}
        <div className="rw-range">
          <CalendarDays size={14} aria-hidden="true" />
          <strong>{periodLabel}</strong>
          <span className="rw-range-vs">{comparisonLabel}</span>
        </div>
      </div>

      {/* Abas da URL — somente tela */}
      <div className="rw-tabs reports-no-print" role="tablist" aria-label="Seções de relatórios">
        {TABS.map((item) => {
          const Icon: LucideIcon = item.icon;
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={"rw-tab" + (selected ? " active" : "")}
              onClick={() => setTab(item.id)}
            >
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ============ Painéis ============ */}
      <div className="rw-panels">

        {tab === "overview" ? (
          serviceSection.loading && !service ? <PanelSkeleton /> :
          serviceSection.error ? <SectionError title="Não foi possível carregar a visão geral" message={serviceSection.error} onRetry={serviceSection.retry} /> :
          service && summary ? (
            <div className="rw-panel" role="tabpanel" aria-label="Visão geral">
              <div className="rw-kpi-grid">
                <Kpi label="Conversas" value={numberBR(summary.total)} delta={deltaPercent(summary.total, comparison?.total)} note="Criadas no período" />
                <Kpi label="Finalizadas" value={numberBR(summary.finished)} delta={deltaPercent(summary.finished, comparison?.finished)} note="Resolvidas ou encerradas" />
                <Kpi label="Em aberto" value={numberBR(summary.open)} delta={deltaPercent(summary.open, comparison?.open)} note="Aguardando atendimento" />
                <Kpi label="Pendentes" value={numberBR(summary.pending)} delta={deltaPercent(summary.pending, comparison?.pending)} note="Aguardando continuidade" />
                <Kpi label="Contatos únicos" value={numberBR(summary.contacts)} delta={deltaPercent(summary.contacts, comparison?.contacts)} note="Pessoas distintas" />
                <Kpi label="Primeira resposta" value={durationFromSeconds(summary.firstMessageSeconds)} delta={deltaPercent(summary.firstMessageSeconds, comparison?.firstMessageSeconds)} invert note={summary.firstMessageSample + " conversas com resposta"} />
              </div>
              <div className="rw-grid-2">
                <section className="rw-card">
                  <CardHead title="Composição do atendimento" hint="Quem conduziu as conversas do período" />
                  <Donut segments={composition} totalLabel="conversas" />
                </section>
                <section className="rw-card">
                  <CardHead title="Comparativo de períodos" hint={comparisonLabel} />
                  <div className="rw-compare">
                    {([
                      ["Conversas", summary.total, comparison?.total],
                      ["Finalizadas", summary.finished, comparison?.finished],
                      ["Em aberto", summary.open, comparison?.open],
                      ["Pendentes", summary.pending, comparison?.pending],
                      ["Atendidas pela IA", summary.bot, comparison?.bot],
                      ["Atendidas por humano", summary.human, comparison?.human],
                    ] as Array<[string, number, number | undefined]>).map(([label, current, previous]) => (
                      <div className="rw-compare-row" key={label}>
                        <span className="rw-compare-label">{label}</span>
                        <span className="rw-compare-current">{numberBR(current)}</span>
                        <Delta value={deltaPercent(current, previous ?? null)} />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="rw-grid-2">
                <section className="rw-card">
                  <CardHead title="Volume por canal" hint="Conversas criadas por canal no período" />
                  <HorizontalBars rows={(service.byChannel ?? []).map((row) => ({ label: row.name, value: row.total, fill: networkColor(row.name) ?? undefined }))} />
                </section>
                <section className="rw-card">
                  <CardHead title="Top atendentes" hint="Maior volume de conversas no período" />
                  <HorizontalBars rows={(service.byAgent ?? []).slice(0, 6).map((row) => ({ label: row.name, value: row.total }))} />
                </section>
              </div>
              {service.basis ? <p className="rw-footnote">{service.basis}</p> : null}
            </div>
          ) : null
        ) : null}

        {tab === "service" ? (
          serviceSection.loading && !service ? <PanelSkeleton /> :
          serviceSection.error ? <SectionError title="Não foi possível carregar o atendimento" message={serviceSection.error} onRetry={serviceSection.retry} /> :
          service && summary ? (
            <div className="rw-panel" role="tabpanel" aria-label="Atendimento">
              <div className="rw-kpi-grid">
                <Kpi label="Taxa de finalização" value={finishRate === null ? "Sem base" : finishRate.toFixed(1).replace(".", ",") + "%"} delta={finishRateDelta} suffix=" p.p." note="Finalizadas sobre o total" />
                <Kpi label="Primeira resposta" value={durationFromSeconds(summary.firstMessageSeconds)} delta={deltaPercent(summary.firstMessageSeconds, comparison?.firstMessageSeconds)} invert note={summary.firstMessageSample + " conversas com resposta"} />
                <Kpi label="Mensagens" value={numberBR(summary.messages)} delta={deltaPercent(summary.messages, comparison?.messages)} note="Todas as direções" />
                <Kpi label="Atendidas pela IA" value={numberBR(summary.bot)} delta={deltaPercent(summary.bot, comparison?.bot)} note="Modo de atendimento registrado" />
                <Kpi label="Atendidas por humano" value={numberBR(summary.human)} delta={deltaPercent(summary.human, comparison?.human)} note="Modo de atendimento registrado" />
                <Kpi label="Pendentes" value={numberBR(summary.pending)} delta={deltaPercent(summary.pending, comparison?.pending)} note="Aguardando continuidade" />
              </div>
              <div className="rw-grid-2">
                <section className="rw-card">
                  <CardHead title="Composição do atendimento" hint="Distribuição por modo de condução" />
                  <Donut segments={composition} totalLabel="conversas" />
                </section>
                <section className="rw-card">
                  <CardHead title="Volume por canal" hint="Em que canais as conversas nasceram" />
                  <HorizontalBars rows={(service.byChannel ?? []).map((row) => ({ label: row.name, value: row.total, fill: networkColor(row.name) ?? undefined }))} />
                </section>
              </div>
              <section className="rw-card">
                <CardHead title="Desempenho por canal" hint="Volume, abertura e finalização por canal" />
                <DataTable
                  caption="Desempenho por canal"
                  columns={["Canal", "Total", "Abertas", "Pendentes", "Finalizadas", "IA / Bot", "Humano"]}
                  rows={(service.byChannel ?? []).map((row) => [row.name, row.total, row.open, row.pending, row.finished, row.bot, row.human])}
                />
              </section>
              {service.basis ? <p className="rw-footnote">{service.basis}</p> : null}
            </div>
          ) : null
        ) : null}

        {tab === "team" ? (
          serviceSection.loading && !service ? <PanelSkeleton /> :
          serviceSection.error ? <SectionError title="Não foi possível carregar a equipe" message={serviceSection.error} onRetry={serviceSection.retry} /> :
          service ? (
            <div className="rw-panel" role="tabpanel" aria-label="Equipe">
              <div className="rw-kpi-grid">
                <Kpi label="Atendentes" value={numberBR(service.byAgent.length)} note="Com conversas no período" />
                <Kpi label="Setores" value={numberBR(service.byDepartment.length)} note="Com conversas no período" />
                <Kpi label="Maior volume" value={topAgent ? numberBR(topAgent.total) : "0"} note={topAgent ? "Conversas com " + topAgent.name : "Sem registros"} />
                <Kpi label="Média por atendente" value={service.byAgent.length ? (summary ? (summary.total / service.byAgent.length).toFixed(1).replace(".", ",") : "0") : "0"} note="Conversas por atendente" />
              </div>
              <div className="rw-grid-2">
                <section className="rw-card">
                  <CardHead title="Conversas por atendente" hint="Top 8 no período" />
                  <HorizontalBars rows={service.byAgent.map((row) => ({ label: row.name, value: row.total }))} />
                </section>
                <section className="rw-card">
                  <CardHead title="Conversas por setor" hint="Top 8 no período" />
                  <HorizontalBars rows={service.byDepartment.map((row) => ({ label: row.name, value: row.total }))} />
                </section>
              </div>
              <section className="rw-card">
                <CardHead title="Desempenho por atendente" hint={service.byAgent.length + " atendentes com atividade"} />
                <DataTable
                  caption="Desempenho por atendente"
                  columns={["Atendente", "Total", "Abertas", "Pendentes", "Finalizadas", "IA / Bot", "Humano"]}
                  rows={service.byAgent.map((row) => [row.name, row.total, row.open, row.pending, row.finished, row.bot, row.human])}
                />
              </section>
              <section className="rw-card">
                <CardHead title="Desempenho por setor" hint={service.byDepartment.length + " setores com atividade"} />
                <DataTable
                  caption="Desempenho por setor"
                  columns={["Setor", "Total", "Abertas", "Pendentes", "Finalizadas"]}
                  rows={service.byDepartment.map((row) => [row.name, row.total, row.open, row.pending, row.finished])}
                />
              </section>
            </div>
          ) : null
        ) : null}

        {tab === "crm" ? (
          <div className="rw-panel" role="tabpanel" aria-label="CRM e Vendas">
            {originsSection.loading && !originsSection.data ? <PanelSkeleton /> : originsSection.error ? (
              <SectionError title="Não foi possível carregar as origens de leads" message={originsSection.error} onRetry={originsSection.retry} />
            ) : originsSection.data ? (() => {
              const origins = originsSection.data;
              const byOrigin = origins.byOrigin ?? [];
              const won = byOrigin.reduce((sum, origin) => sum + origin.won, 0);
              const lost = byOrigin.reduce((sum, origin) => sum + origin.lost, 0);
              const open = byOrigin.reduce((sum, origin) => sum + origin.open, 0);
              const identifiedPct = origins.total > 0 ? (origins.identified / origins.total) * 100 : null;
              return (
                <>
                  <div className="rw-kpi-grid">
                    <Kpi label="Leads no período" value={numberBR(origins.total)} note="Contatos captados" />
                    <Kpi label="Identificados" value={identifiedPct === null ? "Sem base" : identifiedPct.toFixed(0) + "%"} note={origins.identified + " de " + origins.total + " com origem conhecida"} />
                    <Kpi label="Ganhos" value={numberBR(won)} note="Finalizados como ganho" />
                    <Kpi label="Perdas" value={numberBR(lost)} note="Finalizados como perda" />
                    <Kpi label="Em aberto" value={numberBR(open)} note="Ainda em negociação" />
                  </div>
                  <div className="rw-grid-2">
                    <section className="rw-card">
                      <CardHead title="Leads por origem" hint="Canais que trouxeram oportunidades" />
                      <HorizontalBars rows={byOrigin.map((origin) => ({ label: origin.name, value: origin.total, fill: networkColor(origin.name) ?? undefined }))} />
                    </section>
                    <section className="rw-card">
                      <CardHead title="Leads por etapa" hint="Distribuição no funil" />
                      {origins.stages?.length ? (
                        <div className="rw-stage-chips">
                          {origins.stages.map((stage) => (
                            <span className="rw-stage-chip" key={stage.name}>{stage.name}<strong>{numberBR(stage.count)}</strong></span>
                          ))}
                        </div>
                      ) : <EmptyBlock title="Funil sem dados" hint="Nenhum lead com etapa registrada no período." />}
                    </section>
                  </div>
                  <section className="rw-card">
                    <CardHead title="Desempenho por origem" hint={byOrigin.length + " origens com leads no período"} />
                    <DataTable
                      caption="Desempenho por origem de lead"
                      columns={["Origem", "Leads", "Ganhos", "Perdas", "Em aberto", "Com campanha"]}
                      rows={byOrigin.map((origin) => [origin.name, origin.total, origin.won, origin.lost, origin.open, origin.withCampaign])}
                    />
                  </section>
                </>
              );
            })() : null}

            {pipelinesSection.loading && !pipelinesSection.data ? <PanelSkeleton /> : pipelinesSection.error ? (
              <SectionError title="Não foi possível carregar os pipelines" message={pipelinesSection.error} onRetry={pipelinesSection.retry} />
            ) : pipelinesSection.data ? (() => {
              const pipelines = pipelinesSection.data?.pipelines ?? [];
              return (
                <section className="rw-card">
                  <CardHead
                    title="Pipelines e etapas"
                    hint="Estrutura comercial ativa · contagem de cards por etapa não é exposta pela API"
                    aside={<span className="rw-count-pill">{pipelines.length} {pipelines.length === 1 ? "pipeline" : "pipelines"}</span>}
                  />
                  {pipelines.length ? (
                    <div className="rw-pipeline-list">
                      {pipelines.map((pipeline) => {
                        const stages = Array.isArray(pipeline.stages) ? (pipeline.stages as PipelineStage[]) : [];
                        return (
                          <div className="rw-pipeline" key={pipeline.id}>
                            <div className="rw-pipeline-head">
                              <strong>{pipeline.name}</strong>
                              <span>{pipeline.department?.name ?? "Sem setor vinculado"}{pipeline.template ? " · " + pipeline.template : ""}</span>
                            </div>
                            <div className="rw-stage-chips">
                              {stages.length ? stages.map((stage, index) => {
                                const count = typeof stage.count === "number" ? stage.count : typeof stage.cards === "number" ? stage.cards : null;
                                return (
                                  <span className="rw-stage-chip" key={(stage.id ?? "stage") + "-" + index}>
                                    <i className="rw-stage-dot" style={{ background: TONE_COLOR[String(stage.tone ?? "")] ?? STAGE_FALLBACK[index % STAGE_FALLBACK.length] }} aria-hidden="true" />
                                    {stage.label ?? stage.id ?? "Etapa " + (index + 1)}
                                    {count !== null ? <strong>{numberBR(count)}</strong> : null}
                                  </span>
                                );
                              }) : <span className="rw-pipeline-empty">Pipeline sem etapas configuradas.</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyBlock title="Nenhum pipeline ativo" hint="Ative o CRM nos setores em Atendentes → Setores e permissões." />}
                </section>
              );
            })() : null}
          </div>
        ) : null}

        {tab === "finance" ? (
          financeSection.loading && !financeSection.data ? <PanelSkeleton /> :
          financeSection.error ? (
            <SectionError
              title="Não foi possível carregar os dados financeiros"
              message={financeSection.error + " Verifique a conexão com o Asaas em Conexões."}
              onRetry={financeSection.retry}
            />
          ) : financeSection.data ? (() => {
            const finance = financeSection.data;
            const totals = finance.totals;
            return (
              <div className="rw-panel" role="tabpanel" aria-label="Financeiro">
                <div className="rw-kpi-grid">
                  <Kpi label="Faturado" value={currencyBRL(totals.billed)} note="Cobranças válidas no período" />
                  <Kpi label="Recebido" value={currencyBRL(totals.paid)} note={totals.customers + " clientes"} />
                  <Kpi label="Em aberto" value={currencyBRL(totals.open)} note="Aguardando pagamento" />
                  <Kpi label="Vencido" value={currencyBRL(totals.overdue)} note={totals.overdueCount + " cobranças vencidas"} />
                  <Kpi label="Taxa de recebimento" value={finance.collectionRate === null ? "Sem base" : finance.collectionRate.toFixed(1).replace(".", ",") + "%"} note="Recebido sobre o faturado" />
                  <Kpi label="Cobranças" value={numberBR(totals.count)} note="Excluindo canceladas e reembolsadas" />
                </div>
                <section className="rw-card">
                  <CardHead title="Faturado × Recebido por mês" hint="Evolução da régua de cobrança" />
                  <FinanceLine series={finance.series ?? []} />
                </section>
                <div className="rw-grid-2">
                  <section className="rw-card">
                    <CardHead title="Por situação" hint="Status das cobranças" />
                    <DataTable
                      caption="Cobranças por situação"
                      columns={["Situação", "Cobranças", "Valor"]}
                      rows={(finance.byStatus ?? []).map((row) => [STATUS_BR[row.status] ?? row.status, row.count, currencyBRL(row.amount)])}
                    />
                  </section>
                  <section className="rw-card">
                    <CardHead title="Por forma de pagamento" hint="Mix de meios de recebimento" />
                    <DataTable
                      caption="Cobranças por forma de pagamento"
                      columns={["Forma", "Cobranças", "Valor"]}
                      rows={(finance.byBillingType ?? []).map((row) => [BILLING_BR[row.type] ?? row.type, row.count, currencyBRL(row.amount)])}
                    />
                  </section>
                </div>
              </div>
            );
          })() : null
        ) : null}

        {tab === "ai" ? (
          <div className="rw-panel" role="tabpanel" aria-label="IA e Automação">
            <p className="rw-scope-note">Indicadores do painel Véxora — visão atual, não filtrada pelo período selecionado.</p>
            {overviewSection.loading && !overviewSection.data ? <PanelSkeleton /> :
            overviewSection.error ? (
              <SectionError title="Não foi possível carregar os indicadores de IA" message={overviewSection.error} onRetry={overviewSection.retry} />
            ) : overviewSection.data && overviewSection.data.kpis ? (() => {
              const overview = overviewSection.data;
              const kpis = overview.kpis ?? {};
              const completed = overview.completedConversations ?? 0;
              const resolvedByAi = kpis.resolvedByAi ?? 0;
              const aiSegments = [
                { label: "Resolvidas pela IA", value: resolvedByAi, color: "var(--primary)" },
                { label: "Resolvidas por humanos e outros", value: Math.max(0, completed - resolvedByAi), color: "var(--ln2)" },
              ];
              return (
                <>
                  <div className="rw-kpi-grid">
                    <Kpi label="Resolvidas pela IA" value={numberBR(resolvedByAi)} note="Conversas concluídas sem humano" />
                    <Kpi label="Taxa de resolução IA" value={(kpis.resolvedByAiPercent ?? 0).toFixed(0) + "%"} note="Sobre conversas concluídas" />
                    <Kpi label="Conversas concluídas" value={numberBR(completed)} note="No período de referência do painel" />
                    <Kpi label="Receita de pagamentos" value={currencyBRL(kpis.revenue ?? 0)} note={(kpis.payments ?? 0) + " pagamentos conciliados"} />
                    <Kpi label="Primeira resposta" value={durationFromSeconds(kpis.firstResponseSeconds)} note="Média das conversas recentes" />
                    <Kpi label="Agentes ativos" value={numberBR(overview.activeAgents ?? 0) + " / " + numberBR(overview.agentsTotal ?? 0)} note="Agentes de IA habilitados" />
                  </div>
                  <div className="rw-grid-2">
                    <section className="rw-card">
                      <CardHead title="IA × Humano" hint="Quem resolveu as conversas concluídas" />
                      <Donut segments={aiSegments} totalLabel="concluídas" />
                    </section>
                    <section className="rw-card">
                      <CardHead title="Demanda por hora" hint="Conversas criadas por hora nas últimas 24h" />
                      {overview.hourly && overview.hourly.values.length ? (
                        <HourlyBars labels={overview.hourly.labels} values={overview.hourly.values} peakIndex={overview.hourly.peakIndex} />
                      ) : <EmptyBlock title="Sem volume recente" hint="Nenhuma conversa nas últimas 24 horas." />}
                    </section>
                  </div>
                  {overview.topics?.length ? (
                    <section className="rw-card">
                      <CardHead title="Temas mais frequentes" hint="Baseado em assunto e departamento" />
                      <HorizontalBars rows={overview.topics.map((topic, index) => ({ label: topic.label, value: topic.count, fill: networkColor(topic.label) ?? CHART_PALETTE[index % CHART_PALETTE.length] }))} />
                    </section>
                  ) : null}
                </>
              );
            })() : (
              <SectionError title="Indicadores de IA indisponíveis" message="A API de overview não retornou os indicadores de automação. Tente novamente em instantes." onRetry={overviewSection.retry} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* Fallback de carregamento do Suspense (pré-render do Next) */
function ReportsWorkspaceFallback() {
  return (
    <div className="reports-print-root">
      <style>{REPORTS_CSS}</style>
      <PanelSkeleton />
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><defs><linearGradient id="rw-instagram" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FEDA77" /><stop offset=".25" stopColor="#FD1D1D" /><stop offset=".6" stopColor="#D6249F" /><stop offset="1" stopColor="#833AB4" /></linearGradient></defs></svg>
    </div>
  );
}

export function ReportsWorkspace() {
  return (
    <Suspense fallback={<ReportsWorkspaceFallback />}>
      <ReportsWorkspaceInner />
    </Suspense>
  );
}
export default ReportsWorkspace;

/* ================================================================== */
/* Estilos com escopo · auto-contidos (não alteram vexora.css)         */
/* ================================================================== */
const REPORTS_CSS = `
.reports-print-root{--rw-gap:14px;display:flex;flex-direction:column;gap:16px;min-width:0;color:var(--tx);font-variant-numeric:tabular-nums}
.rw-visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* ---------- Barra superior ---------- */
.rw-top{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap}
.rw-badge{display:inline-flex;align-items:center;padding:3px 11px;border-radius:99px;border:1px solid color-mix(in srgb,var(--primary) 26%,var(--ln));background:var(--primary-soft);color:var(--primary-ink);font:700 10px/1.7 var(--font-ui);letter-spacing:.09em;text-transform:uppercase}
.rw-top h1{font:800 clamp(26px,2.4vw,34px)/1.05 var(--font-display);letter-spacing:-.03em;color:var(--tx);margin:10px 0 6px}
.rw-sub{color:var(--tx2);font-size:13px;max-width:560px}
.rw-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.rw-btn{display:inline-flex;align-items:center;gap:7px;padding:0 13px;min-height:36px;border-radius:var(--r-sm);border:1px solid var(--ln);background:var(--s1);color:var(--tx);font:700 12.5px var(--font-ui);cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,color .15s,transform .15s}
.rw-btn:hover{background:var(--hover);border-color:var(--ln2)}
.rw-btn:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.rw-btn-primary{background:linear-gradient(150deg,color-mix(in srgb,var(--primary) 82%,#FFFFFF),var(--primary) 60%,color-mix(in srgb,var(--primary) 86%,#000));border-color:transparent;color:var(--primary-contrast);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 10px 22px -14px color-mix(in srgb,var(--primary) 78%,transparent)}
.rw-btn-primary:hover{background:linear-gradient(150deg,color-mix(in srgb,var(--primary) 88%,#FFFFFF),var(--primary) 62%);color:var(--primary-contrast)}
.rw-btn-ghost{background:var(--s1)}

/* ---------- Filtro de período ---------- */
.rw-period{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--ln);border-radius:var(--r);background:linear-gradient(180deg,var(--s1),color-mix(in srgb,var(--s1) 94%,var(--bg)));box-shadow:var(--shadow-sm)}
.rw-presets{display:flex;gap:6px;flex-wrap:wrap}
.rw-chip{padding:0 13px;min-height:32px;border-radius:99px;border:1px solid var(--ln);background:var(--s2);color:var(--tx2);font:600 12px var(--font-ui);cursor:pointer;transition:background .14s,color .14s,border-color .14s}
.rw-chip:hover{background:var(--s3);color:var(--tx)}
.rw-chip.active{background:var(--primary);border-color:var(--primary);color:var(--primary-contrast)}
.rw-chip:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.rw-custom{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.rw-custom label{display:flex;align-items:center;gap:6px;font:600 12px var(--font-ui);color:var(--tx2)}
.rw-custom input[type="date"]{min-height:34px;padding:0 10px;border:1px solid var(--ln2);border-radius:9px;background:var(--s1);color:var(--tx);font:500 12px var(--font-ui)}
.rw-custom input[type="date"]:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.rw-custom-error{color:var(--bad);font-size:11.5px;font-weight:600;flex-basis:100%}
.rw-range{display:flex;align-items:center;gap:9px;color:var(--tx2);font-size:12.5px}
.rw-range strong{color:var(--tx);font-variant-numeric:tabular-nums}
.rw-range-vs{border-left:1px solid var(--ln2);padding-left:9px;font-size:11.5px}

/* ---------- Abas ---------- */
.rw-tabs{display:flex;gap:4px;padding:5px;border:1px solid var(--ln);border-radius:var(--r-sm);background:var(--s2);overflow-x:auto;scrollbar-width:none}
.rw-tabs::-webkit-scrollbar{display:none}
.rw-tab{display:inline-flex;align-items:center;gap:7px;padding:0 14px;min-height:36px;border:0;border-radius:9px;background:transparent;color:var(--tx2);font:600 12.5px var(--font-ui);white-space:nowrap;cursor:pointer;transition:background .14s,color .14s}
.rw-tab:hover{background:var(--s3);color:var(--tx)}
.rw-tab.active,.rw-tab[aria-selected="true"]{background:linear-gradient(150deg,color-mix(in srgb,var(--primary) 84%,#FFFFFF),var(--primary));color:var(--primary-contrast);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.rw-tab:focus-visible{outline:2px solid var(--primary);outline-offset:2px}

/* ---------- Painéis e cartões ---------- */
.rw-panels{min-width:0}
.rw-panel{display:flex;flex-direction:column;gap:14px;min-width:0}
.rw-scope-note{margin:0;padding:9px 13px;border:1px solid var(--ln);border-left:3px solid var(--primary);border-radius:var(--r-sm);background:var(--s2);color:var(--tx2);font-size:12px}
.rw-card{min-width:0;padding:16px 18px;border:1px solid var(--ln);border-radius:var(--r);background:linear-gradient(180deg,var(--s1),color-mix(in srgb,var(--s1) 94%,var(--bg)));box-shadow:var(--shadow-sm)}
.rw-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.rw-card-title{font:750 15px/1.35 var(--font-display);letter-spacing:-.015em;color:var(--tx);margin:0}
.rw-card-hint{margin:3px 0 0;font-size:11.5px;color:var(--tx2)}
.rw-card-aside{flex:none}
.rw-count-pill{display:inline-flex;align-items:center;padding:2px 10px;border-radius:99px;background:var(--s3);border:1px solid var(--ln);color:var(--tx2);font:700 11px var(--font-ui)}
.rw-footnote{margin:0;font-size:11px;line-height:1.55;color:var(--tx2);border-top:1px dashed var(--ln2);padding-top:10px}

/* ---------- KPIs ---------- */
.rw-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:12px}
.rw-kpi{display:flex;flex-direction:column;gap:2px}
.rw-kpi-label{font:700 10.5px var(--font-ui);letter-spacing:.07em;text-transform:uppercase;color:var(--tx2)}
.rw-kpi-value{font:800 clamp(21px,1.9vw,29px)/1.15 var(--font-display);letter-spacing:-.03em;color:var(--tx);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:4px 0 6px}
.rw-kpi-foot{display:flex;flex-direction:column;gap:5px;margin-top:auto}
.rw-kpi-note{font-size:11px;color:var(--tx2)}
.rw-delta{display:inline-flex;align-items:center;gap:5px;width:max-content;padding:2px 9px;border-radius:99px;font:700 11px var(--font-ui);font-variant-numeric:tabular-nums}
.rw-delta.up{color:var(--ok);background:color-mix(in srgb,var(--ok) 11%,var(--s1))}
.rw-delta.down{color:var(--bad);background:color-mix(in srgb,var(--bad) 11%,var(--s1))}
.rw-delta.flat{color:var(--tx2);background:var(--s3)}

/* ---------- Grade de duas colunas ---------- */
.rw-grid-2{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);gap:14px;align-items:stretch}
.rw-grid-2>.rw-card{display:flex;flex-direction:column}

/* ---------- Barras horizontais SVG ---------- */
.rw-hbars{display:flex;flex-direction:column;gap:9px}
.rw-hbar-row{display:grid;grid-template-columns:minmax(88px,180px) minmax(0,1fr) 52px;align-items:center;gap:10px;min-width:0}
.rw-hbar-label{font-size:12px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rw-hbar-track{width:100%;height:12px;display:block}
.rw-hbar-bg{fill:var(--s3)}
.rw-hbar-fill{fill:var(--primary)}
.rw-hbar-value{text-align:right;font:700 12px var(--font-ui);color:var(--tx2);font-variant-numeric:tabular-nums}

/* ---------- Rosca SVG ---------- */
.rw-donut-wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.rw-donut{width:132px;height:132px;flex:none}
.rw-donut-track{stroke:var(--s3)}
.rw-donut-total{fill:var(--tx);font:800 22px var(--font-display);letter-spacing:-.02em}
.rw-donut-caption{fill:var(--tx2);font:600 9px var(--font-ui);text-transform:uppercase;letter-spacing:.08em}
.rw-legend{list-style:none;margin:0;padding:0;display:grid;gap:9px;min-width:170px}
.rw-legend-item{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--tx2)}
.rw-legend-dot{width:11px;height:11px;border-radius:3.5px;flex:none;display:inline-block}
.rw-legend-dot.rw-dot-billed{background:var(--primary);border-radius:99px}
.rw-legend-dot.rw-dot-paid{background:#FBBF24;border-radius:99px}
.rw-legend-label{flex:1;min-width:0}
.rw-legend-value{color:var(--tx);font-variant-numeric:tabular-nums}

/* ---------- Comparativo ---------- */
.rw-compare{display:flex;flex-direction:column}
.rw-compare-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:9px 2px;border-top:1px solid var(--ln)}
.rw-compare-row:first-child{border-top:0;padding-top:2px}
.rw-compare-label{font-size:12.5px;color:var(--tx2)}
.rw-compare-current{font:800 15px var(--font-display);color:var(--tx);letter-spacing:-.02em}

/* ---------- Série financeira (linha SVG) ---------- */
.rw-linechart{display:flex;flex-direction:column;gap:8px}
.rw-linechart svg{width:100%;height:auto;display:block}
.rw-gridline{stroke:var(--ln);stroke-width:1}
.rw-ylabel{fill:var(--tx2);font:600 9px var(--font-ui);font-variant-numeric:tabular-nums}
.rw-xlabel{fill:var(--tx2);font:600 9px var(--font-ui)}
.rw-line-billed{stroke:var(--primary);stroke-width:2.4;stroke-linecap:butt;stroke-linejoin:round}
.rw-line-paid{stroke:#FBBF24;stroke-width:2.2;stroke-linecap:butt;stroke-linejoin:round}
.rw-line-area{fill:color-mix(in srgb,var(--primary) 8%,transparent)}
.rw-dot-billed{fill:var(--primary)}
.rw-dot-paid{fill:#FBBF24}
.rw-linechart-legend{display:flex;gap:16px;font-size:11.5px;color:var(--tx2)}
.rw-linechart-legend span{display:inline-flex;align-items:center;gap:7px}

/* ---------- Demanda por hora ---------- */
.rw-hourly{width:100%;height:auto;display:block}
.rw-hour-bar{fill:var(--ln2)}
.rw-hour-peak{fill:var(--primary)}

/* ---------- Tabelas ---------- */
.rw-table-wrap{overflow-x:auto;margin:0 -6px}
.rw-table{width:100%;border-collapse:collapse;font-size:12.5px}
.rw-table caption{text-align:left}
.rw-table th{padding:8px 10px;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--tx2);text-align:left;border-bottom:1px solid var(--ln2)}
.rw-table td{padding:9px 10px;border-top:1px solid var(--ln);color:var(--tx);font-variant-numeric:tabular-nums}
.rw-table tbody tr:hover{background:color-mix(in srgb,var(--s2) 80%,transparent)}
.rw-table-empty{color:var(--tx2);text-align:center;padding:18px 10px}

/* ---------- Chips de etapa / pipelines ---------- */
.rw-stage-chips{display:flex;flex-wrap:wrap;gap:8px}
.rw-stage-chip{display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:99px;border:1px solid var(--ln);background:var(--s2);color:var(--tx2);font:600 12px var(--font-ui)}
.rw-stage-chip strong{color:var(--tx);font-variant-numeric:tabular-nums}
.rw-stage-dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.rw-pipeline-list{display:flex;flex-direction:column;gap:12px}
.rw-pipeline{display:grid;gap:8px;padding:12px 14px;border:1px solid var(--ln);border-radius:var(--r-sm);background:var(--s2)}
.rw-pipeline-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.rw-pipeline-head strong{font:750 13.5px var(--font-display);color:var(--tx)}
.rw-pipeline-head span{font-size:11.5px;color:var(--tx2)}
.rw-pipeline-empty{font-size:12px;color:var(--tx2)}

/* ---------- Vazio / erro ---------- */
.rw-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:26px 16px;border:1px dashed var(--ln2);border-radius:var(--r-sm);color:var(--tx2)}
.rw-empty strong{color:var(--tx);font-size:13px}
.rw-empty p{font-size:12px;max-width:420px}
.rw-error{display:flex;align-items:center;gap:14px;padding:18px 18px;border:1px solid color-mix(in srgb,var(--bad) 32%,var(--ln));border-radius:var(--r);background:color-mix(in srgb,var(--bad) 6%,var(--s1));color:var(--tx)}
.rw-error>svg{color:var(--bad);flex:none}
.rw-error-body{flex:1;min-width:0}
.rw-error-body strong{font-size:13px}
.rw-error-body p{margin:3px 0 0;font-size:12px;color:var(--tx2);overflow-wrap:anywhere}

/* ---------- Skeletons ---------- */
.rw-skeleton{display:flex;flex-direction:column;gap:14px}
.rw-skel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:12px}
.rw-skel{border-radius:var(--r);background:linear-gradient(100deg,var(--s3) 20%,var(--hover) 40%,var(--s3) 60%);background-size:200% 100%;animation:rw-shimmer 1.4s ease-in-out infinite}
.rw-skel-card{height:118px}
.rw-skel-chart{height:190px}
.rw-skel-chart-short{height:150px}
@keyframes rw-shimmer{0%{background-position:120% 0}100%{background-position:-80% 0}}

/* ---------- Capa institucional (somente impressão) ---------- */
.reports-print-only{display:none}
.rw-print-cover{align-items:center;gap:12pt}
.rw-print-mark{display:grid;place-items:center;width:34pt;height:34pt;border-radius:9pt;background:#164E8A;color:#fff;font:800 17pt var(--font-display)}
.rw-print-text{display:flex;flex-direction:column;gap:2pt}
.rw-print-text strong{font:800 13pt var(--font-display);color:#14171a;letter-spacing:-.01em}
.rw-print-text small{font-size:8pt;color:#454f47}

/* ---------- Responsivo ---------- */
@media (max-width:1100px){
  .rw-grid-2{grid-template-columns:1fr}
}
@media (max-width:900px){
  .rw-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rw-top{align-items:flex-start}
  .rw-actions{width:100%}
  .rw-actions .rw-btn{flex:1;justify-content:center}
  .rw-period{align-items:flex-start;flex-direction:column}
  .rw-range{border-top:1px solid var(--ln);padding-top:10px;width:100%}
}
@media (max-width:560px){
  .rw-kpi-grid{grid-template-columns:1fr}
  .rw-kpi-value{white-space:normal}
}

/* ================================================================== */
/* IMPRESSÃO · @media print                                            */
/* Só .reports-print-root sobrevive: chrome da aplicação some.         */
/* ================================================================== */
@media print{
  @page{size:A4;margin:13mm 12mm}
  html,body{height:auto !important;overflow:visible !important;background:#fff !important}
  aside,header,nav,.mobile-sidebar-backdrop,.operation-notices,.workspace-alerts,.sidebar,.topbar,.persistent-module-tabs,.side-nav,.ai-assistant-panel,.ai-assistant-trigger,.crm-workspace > .crm-heading,.crm-workspace > .crm-command-bar,.crm-workspace > .settings-feedback,.crm-workspace > .crm-form,.reports-no-print{display:none !important}
  .suite-app{display:block !important;min-height:0 !important;height:auto !important}
  .main-area{display:block !important;height:auto !important;overflow:visible !important;margin:0 !important;padding:0 !important}
  .page-content{display:block !important;overflow:visible !important;padding:0 !important;max-width:none !important;margin:0 !important}
  .settings-workspace,.reports-workspace,.crm-workspace{display:block !important;padding:0 !important;margin:0 !important;gap:0 !important}
  .reports-print-only{display:flex !important}
  .reports-print-root{
    display:block;
    --s1:#ffffff;--s2:#f6f7f5;--s3:#eaece7;--hover:#eaece7;
    --tx:#14171a;--tx2:#454f47;--ln:#D8DEE9;--ln2:#c3c8bd;
    --primary:#164E8A;--primary-ink:#0B2740;--primary-contrast:#ffffff;--primary-soft:#E7EFFC;
    --ok:#164E8A;--bad:#B4402E;--warn:#9A5B09;--accent2:#2C7BC4;--ln-soft:#D8DEE9;
    background:#fff !important;color:#14171a !important;
    font-size:10.5pt;gap:8pt !important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .rw-print-cover{display:flex !important;align-items:center;gap:12pt;padding-bottom:10pt;margin-bottom:12pt;border-bottom:2.5pt solid #164E8A;break-after:avoid}
  .rw-panel,.rw-panels{display:block !important}
  .rw-panel > * + *{margin-top:8pt}
  .rw-card{box-shadow:none !important;border:1pt solid #D8DEE9 !important;background:#fff !important;break-inside:avoid;page-break-inside:avoid;padding:9pt 11pt !important}
  .rw-card-head{margin-bottom:6pt}
  .rw-card-title{font-size:10.5pt}
  .rw-card-hint{display:none}
  .rw-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:6pt !important}
  .rw-kpi-value{font-size:15pt !important;white-space:normal !important}
  .rw-kpi-label{font-size:7pt !important}
  .rw-grid-2{grid-template-columns:1fr 1fr !important;gap:6pt !important}
  .rw-footnote{border-top:0.5pt solid #c3c8bd;font-size:7.5pt}
  .rw-scope-note{border:0.5pt solid #D8DEE9;font-size:8pt}
  .rw-table{font-size:8pt}
  .rw-table thead{display:table-header-group}
  .rw-table tr{break-inside:avoid;page-break-inside:avoid}
  .rw-table th{background:#f2f3ef !important}
  .rw-delta{border:0.5pt solid currentColor;background:transparent !important}
  .rw-hbar-fill{fill:#164E8A !important}
  .rw-hbar-bg{fill:#eaece7 !important}
  .rw-donut-track{stroke:#eaece7 !important}
  .rw-legend-dot{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rw-legend-dot.rw-dot-billed{background:#164E8A !important}
  .rw-legend-dot.rw-dot-paid{background:#FBBF24 !important}
  .rw-line-billed{stroke:#164E8A !important}
  .rw-line-paid{stroke:#FBBF24 !important}
  .rw-dot-billed{fill:#164E8A !important}
  .rw-dot-paid{fill:#FBBF24 !important}
  .rw-line-area{fill:#eef4f0 !important}
  .rw-gridline,.rw-hour-bar{stroke:#D8DEE9}
  .rw-hour-bar{fill:#c3c8bd !important}
  .rw-hour-peak{fill:#164E8A !important}
  .rw-hour-peak,.rw-dot-billed,.rw-dot-paid,.rw-stage-dot,.rw-print-mark{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1,h2,h3{page-break-after:avoid;break-after:avoid}
}
`;
