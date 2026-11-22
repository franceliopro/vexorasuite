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
  won?: number;
  lost?: number;
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
const barColor = (label: string, index: number): string => networkColor(label) ?? CHART_PALETTE[index % CHART_PALETTE.length] ?? "#4F46E5";
const deltaTw: Record<"up" | "down" | "flat", string> = {
  up: "bg-blue-100 text-blue-800",
  down: "bg-red-100 text-red-600",
  flat: "bg-zinc-300 text-slate-600",
};
const chipTw = "min-h-8 rounded-full border border-gray-200 bg-zinc-200 px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-zinc-300 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const chipActive = "border-blue-600 bg-blue-600 text-blue-900";
const tabTw = "inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors hover:bg-zinc-300 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const tabActive = "bg-blue-600 text-white shadow-sm";


/* ================================================================== */
/* Blocos visuais                                                      */
/* ================================================================== */
function Delta({ value, invert = false, suffix = "%" }: { value: number | null; invert?: boolean; suffix?: string }) {
  const tone = deltaTone(value, invert);
  const arrow = value === null || value === 0 ? "–" : value > 0 ? "▲" : "▼";
  return (
    <span className={deltaTw[tone]} data-print={"delta " + tone} title={value === null ? "Sem base de comparação" : "Variação vs. período anterior"}>
      <span aria-hidden="true">{arrow}</span> {deltaLabel(value, suffix)}
    </span>
  );
}
function Kpi({ label, value, note, delta, invert, suffix }: { label: string; value: ReactNode; note?: string; delta?: number | null; invert?: boolean; suffix?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm gap-0.5" data-print="card kpi">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-600" data-print="kpi-label">{label}</span>
      <strong className="m-1 mb-1.5 truncate text-2xl font-extrabold tabular-nums text-slate-950 sm:whitespace-normal" data-print="kpi-value">{value}</strong>
      <div className="mt-auto flex flex-col gap-1.5" data-print="kpi-foot">
        {delta !== undefined ? <Delta value={delta} invert={invert} suffix={suffix} /> : null}
        {note ? <small className="text-xs text-slate-600" data-print="kpi-note">{note}</small> : null}
      </div>
    </div>
  );
}
function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" data-print="skeleton" aria-busy="true" role="status" aria-label="Carregando indicadores">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-print="skel-grid">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="rounded-xl animate-pulse bg-zinc-300 h-28" data-print="skel skel-card" />)}
      </div>
      <div className="rounded-xl animate-pulse bg-zinc-300 h-48" data-print="skel skel-chart" />
      <div className="rounded-xl animate-pulse bg-zinc-300 h-36" data-print="skel skel-chart-short" />
    </div>
  );
}
function SectionError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-red-600 bg-red-100 p-4 text-slate-950" data-print="error" role="alert">
      <CircleAlert size={26} strokeWidth={1.6} className="flex-none text-red-600" aria-hidden="true" />
      <div className="min-w-0 flex-1" data-print="error-body">
        <strong className="text-sm text-slate-950">{title}</strong>
        <p className="m-0 mt-1 break-words text-xs text-slate-600">{message}</p>
      </div>
      <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rw-laptop:w-full rw-laptop:flex-1 rw-laptop:justify-center" data-print="btn btn-ghost" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
      </button>
    </div>
  );
}
function EmptyBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-slate-600" data-print="empty">
      <CircleAlert size={22} strokeWidth={1.6} aria-hidden="true" />
      <strong className="text-sm text-slate-950">{title}</strong>
      {hint ? <p className="max-w-xs text-xs">{hint}</p> : null}
    </div>
  );
}
function CardHead({ title, hint, aside }: { title: string; hint?: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3" data-print="card-head">
      <div>
        <h3 className="m-0 text-base font-semibold text-slate-950" data-print="card-title">{title}</h3>
        {hint ? <p className="m-0 mt-1 text-xs text-slate-600" data-print="card-hint">{hint}</p> : null}
      </div>
      {aside ? <div className="flex-none" data-print="card-aside">{aside}</div> : null}
    </div>
  );
}
function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="-mx-1.5 overflow-x-auto" data-print="table-wrap">
      <table className="w-full border-collapse text-xs" data-print="table">
        <caption className="sr-only" data-print="visually-hidden">{caption}</caption>
        <thead>
          <tr>{columns.map((column) => <th key={column} scope="col" className="border-b border-gray-300 px-2.5 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-600">{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index} className="transition-colors hover:bg-zinc-200">{row.map((cell, cellIndex) => <td key={cellIndex} className="border-t border-gray-200 px-2.5 py-2.5 tabular-nums text-slate-950">{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={columns.length} className="px-2.5 py-4 text-center text-slate-600" data-print="table-empty">Sem registros para este período.</td></tr>
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
    <div className="flex flex-col gap-2.5" data-print="hbars">
      {visible.map((row, index) => {
        const width = Math.max(row.value > 0 ? 3 : 0, (row.value / max) * 100);
        const fill = row.fill ?? barColor(row.label, index);
        return (
          <div className="flex min-w-0 items-center gap-2.5" data-print="hbar-row" key={row.label}>
            <span className="w-28 shrink-0 truncate text-xs font-semibold text-slate-950 md:w-44" data-print="hbar-label" title={row.label}>{row.label}</span>
            <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-300" data-print="hbar-track" role="img" aria-label={row.label + ": " + render(row.value)}>
              {row.value > 0 ? <i className="block h-full rounded-full bg-blue-600 transition-all duration-300 ease-out" data-print="hbar-fill" style={{ width: width + "%", background: fill }} /> : null}
            </div>
            <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums text-slate-600" data-print="hbar-value">{render(row.value)}</span>
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
    <div className="flex flex-wrap items-center gap-4" data-print="donut-wrap">
      <svg className="h-32 w-32 flex-none" data-print="donut" viewBox={"0 0 " + size + " " + size} role="img" aria-label={"Distribuição: " + segments.map((segment) => segment.label + " " + segment.value).join(", ")}>
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={thickness} className="stroke-zinc-300" data-print="donut-track" />
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
        <text x={center} y={center - 1} textAnchor="middle" className="fill-slate-950 text-2xl font-extrabold" data-print="donut-total">{numberBR(total)}</text>
        <text x={center} y={center + 14} textAnchor="middle" className="fill-slate-600 text-xs font-semibold uppercase tracking-wider" data-print="donut-caption">{totalLabel}</text>
      </svg>
      <ul className="grid min-w-40 list-none gap-2.5 p-0" data-print="legend">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2.5 text-xs text-slate-600" data-print="legend-item">
            <span className="inline-block h-2.5 w-2.5 flex-none rounded-sm" data-print="legend-dot" style={{ background: segment.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1" data-print="legend-label">{segment.label}</span>
            <strong className="tabular-nums text-slate-950" data-print="legend-value">{numberBR(segment.value)}</strong>
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
    <div className="flex flex-col gap-2" data-print="linechart">
      <svg className="block h-auto w-full" data-print="line-svg" viewBox={"0 0 " + width + " " + height} role="img" aria-label="Evolução mensal de faturado e recebido">
        {gridFractions.map((fraction) => {
          const gy = y(max * fraction);
          return (
            <g key={fraction}>
              <line x1={padLeft} y1={gy} x2={width - padRight} y2={gy} className="stroke-gray-200" data-print="gridline" />
              <text x={padLeft - 8} y={gy + 3} textAnchor="end" className="fill-slate-600 text-xs font-semibold tabular-nums" data-print="ylabel">{compactBRL(max * fraction)}</text>
            </g>
          );
        })}
        {areaPath ? <path d={areaPath} className="fill-blue-50" data-print="line-area" /> : null}
        {paidPath ? <path d={paidPath} className="stroke-2 stroke-amber-400" data-print="line-paid" fill="none" /> : null}
        {billedPath ? <path d={billedPath} className="stroke-2 stroke-blue-600" data-print="line-billed" fill="none" /> : null}
        {series.map((point, index) => (
          <g key={point.month}>
            <circle cx={x(index)} cy={y(point.billed)} r={3} className="rounded-full bg-blue-600 fill-blue-600" data-print="dot-billed"><title>{shortMonth(point.month) + " · Faturado: " + currencyBRL(point.billed)}</title></circle>
            <circle cx={x(index)} cy={y(point.paid)} r={3} className="rounded-full bg-amber-400 fill-amber-400" data-print="dot-paid"><title>{shortMonth(point.month) + " · Recebido: " + currencyBRL(point.paid)}</title></circle>
            <text x={x(index)} y={height - 10} textAnchor="middle" className="fill-slate-600 text-xs font-semibold" data-print="xlabel">{shortMonth(point.month)}</text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 text-xs text-slate-600" data-print="linechart-legend">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 flex-none rounded-full bg-blue-600 fill-blue-600" data-print="legend-dot dot-billed" aria-hidden="true" /> Faturado</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 flex-none rounded-full bg-amber-400 fill-amber-400" data-print="legend-dot dot-paid" aria-hidden="true" /> Recebido</span>
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
    <svg className="block h-auto w-full" data-print="hourly" viewBox={"0 0 " + width + " " + height} role="img" aria-label="Volume de conversas por hora nas últimas 24 horas">
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
            className={isPeak ? "fill-blue-600" : "fill-gray-300"} data-print={isPeak ? "hour-peak" : "hour-bar"}
          >
            <title>{(labels[index] ?? String(index) + "h") + ": " + value + " conversas"}</title>
          </rect>
        );
      })}
      <line x1={0} y1={baseline} x2={width} y2={baseline} className="stroke-gray-200" data-print="gridline" />
      {[0, 6, 12, 18].map((hour) => (
        <text key={hour} x={hour * slot + slot / 2} y={height - 2} textAnchor="middle" className="fill-slate-600 text-xs font-semibold" data-print="xlabel">{String(hour).padStart(2, "0") + "h"}</text>
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
        rows.push([pipeline.name, pipeline.department?.name ?? "Sem setor", stages.map((stage) => (stage.label ?? stage.id ?? "") + (typeof stage.count === "number" ? " (" + stage.count + ")" : "")).filter(Boolean).join(" → ")]);
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
    <div className="flex min-w-0 flex-col gap-4 bg-zinc-50 text-slate-950 tabular-nums dark:bg-slate-900 dark:text-slate-100" data-print="print-root">
      <style>{REPORTS_CSS}</style>

      {/* Capa institucional — somente impressão */}
      <div className="items-center gap-3 hidden print:flex" data-print="print-cover print-only" aria-hidden="true">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-800 text-base font-extrabold text-blue-900" data-print="print-mark">V</span>
        <span className="flex flex-col gap-0.5" data-print="print-text">
          <strong>{"Véxora Suite · Relatórios · " + periodLabel}</strong>
          <small>{"Emitido em " + generatedLabel + " · " + comparisonLabel}</small>
        </span>
      </div>

      {/* Barra superior — somente tela */}
      <div className="flex flex-wrap items-end justify-between gap-5 rw-laptop:items-start print:hidden" data-print="top no-print">
        <div className="grid" data-print="head-left">
          <span className="inline-flex items-center rounded-full border border-blue-600/30 bg-blue-50 px-3 py-0.5 text-xs font-bold uppercase tracking-widest text-blue-800" data-print="badge">Véxora Suite</span>
          <h1 className="mb-1.5 mt-2.5 text-3xl font-extrabold tracking-tight text-slate-950" data-print="top-title">Relatórios</h1>
          <p className="max-w-2xl text-sm text-slate-600" data-print="sub">Indicadores executivos de atendimento, equipe, vendas, financeiro e automação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rw-laptop:w-full" data-print="actions">
          <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rw-laptop:w-full rw-laptop:flex-1 rw-laptop:justify-center" data-print="btn btn-ghost" onClick={refreshAll} title="Recarregar todos os indicadores">
            <RefreshCw size={15} aria-hidden="true" /> Atualizar
          </button>
          <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rw-laptop:w-full rw-laptop:flex-1 rw-laptop:justify-center" data-print="btn btn-ghost" onClick={() => window.print()} title="Gera o PDF pela impressão do navegador">
            <Printer size={15} aria-hidden="true" /> Baixar PDF
          </button>
          <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rw-laptop:w-full rw-laptop:flex-1 rw-laptop:justify-center border-transparent bg-blue-600 text-blue-900 shadow-sm hover:bg-blue-700" data-print="btn btn-primary" onClick={exportCsv} title="Exporta a seção ativa em CSV (Excel)">
            <FileDown size={15} aria-hidden="true" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtro de período — somente tela */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-zinc-100 p-3.5 shadow-sm rw-laptop:flex-col rw-laptop:items-start print:hidden" data-print="period no-print">
        <div className="flex flex-wrap gap-1.5" data-print="presets" role="group" aria-label="Selecionar período">
          {PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={chipTw + (preset === option.id ? " " + chipActive : "")} data-print={"chip" + (preset === option.id ? " active" : "")}
              aria-pressed={preset === option.id}
              onClick={() => selectPreset(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="flex flex-wrap items-center gap-2.5" data-print="custom">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">De<input type="date" className="min-h-9 rounded-lg border border-gray-300 bg-zinc-100 px-2.5 text-xs font-medium text-slate-950" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">Até<input type="date" className="min-h-9 rounded-lg border border-gray-300 bg-zinc-100 px-2.5 text-xs font-medium text-slate-950" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
            <button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rw-laptop:w-full rw-laptop:flex-1 rw-laptop:justify-center" data-print="btn btn-ghost" onClick={applyCustomRange}>Aplicar</button>
            {customError ? <small className="basis-full text-xs font-semibold text-red-600" data-print="custom-error" role="alert">{customError}</small> : null}
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-xs text-slate-600 rw-laptop:w-full rw-laptop:border-t rw-laptop:border-gray-200 rw-laptop:pt-2.5" data-print="range">
          <CalendarDays size={14} aria-hidden="true" />
          <strong className="font-bold tabular-nums text-slate-950">{periodLabel}</strong>
          <span className="border-l border-gray-300 pl-2.5 text-xs" data-print="range-vs">{comparisonLabel}</span>
        </div>
      </div>

      {/* Abas da URL — somente tela */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-zinc-200 p-1 print:hidden" data-print="tabs no-print" role="tablist" aria-label="Seções de relatórios">
        {TABS.map((item) => {
          const Icon: LucideIcon = item.icon;
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={tabTw + (selected ? " " + tabActive : " text-slate-600")} data-print={"tab" + (selected ? " active" : "")}
              onClick={() => setTab(item.id)}
            >
              <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ============ Painéis ============ */}
      <div className="min-w-0" data-print="panels">

        {tab === "overview" ? (
          serviceSection.loading && !service ? <PanelSkeleton /> :
          serviceSection.error ? <SectionError title="Não foi possível carregar a visão geral" message={serviceSection.error} onRetry={serviceSection.retry} /> :
          service && summary ? (
            <div className="flex min-w-0 flex-col gap-3.5" data-print="panel" role="tabpanel" aria-label="Visão geral">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-print="kpi-grid">
                <Kpi label="Conversas" value={numberBR(summary.total)} delta={deltaPercent(summary.total, comparison?.total)} note="Criadas no período" />
                <Kpi label="Finalizadas" value={numberBR(summary.finished)} delta={deltaPercent(summary.finished, comparison?.finished)} note="Resolvidas ou encerradas" />
                <Kpi label="Em aberto" value={numberBR(summary.open)} delta={deltaPercent(summary.open, comparison?.open)} note="Aguardando atendimento" />
                <Kpi label="Pendentes" value={numberBR(summary.pending)} delta={deltaPercent(summary.pending, comparison?.pending)} note="Aguardando continuidade" />
                <Kpi label="Contatos únicos" value={numberBR(summary.contacts)} delta={deltaPercent(summary.contacts, comparison?.contacts)} note="Pessoas distintas" />
                <Kpi label="Primeira resposta" value={durationFromSeconds(summary.firstMessageSeconds)} delta={deltaPercent(summary.firstMessageSeconds, comparison?.firstMessageSeconds)} invert note={summary.firstMessageSample + " conversas com resposta"} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-3.5" data-print="grid-2">
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Composição do atendimento" hint="Quem conduziu as conversas do período" />
                  <Donut segments={composition} totalLabel="conversas" />
                </section>
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Comparativo de períodos" hint={comparisonLabel} />
                  <div className="flex flex-col" data-print="compare">
                    {([
                      ["Conversas", summary.total, comparison?.total],
                      ["Finalizadas", summary.finished, comparison?.finished],
                      ["Em aberto", summary.open, comparison?.open],
                      ["Pendentes", summary.pending, comparison?.pending],
                      ["Atendidas pela IA", summary.bot, comparison?.bot],
                      ["Atendidas por humano", summary.human, comparison?.human],
                    ] as Array<[string, number, number | undefined]>).map(([label, current, previous]) => (
                      <div className="grid grid-cols-3 items-center gap-3 border-t border-gray-200 px-0.5 py-2.5 first:border-t-0 first:pt-0.5" data-print="compare-row" key={label}>
                        <span className="text-xs text-slate-600" data-print="compare-label">{label}</span>
                        <span className="text-base font-extrabold tracking-tight text-slate-950" data-print="compare-current">{numberBR(current)}</span>
                        <Delta value={deltaPercent(current, previous ?? null)} />
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-3.5" data-print="grid-2">
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Volume por canal" hint="Conversas criadas por canal no período" />
                  <HorizontalBars rows={(service.byChannel ?? []).map((row) => ({ label: row.name, value: row.total, fill: networkColor(row.name) ?? undefined }))} />
                </section>
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Top atendentes" hint="Maior volume de conversas no período" />
                  <HorizontalBars rows={(service.byAgent ?? []).slice(0, 6).map((row) => ({ label: row.name, value: row.total }))} />
                </section>
              </div>
              {service.basis ? <p className="m-0 border-t border-dashed border-gray-300 pt-2.5 text-xs leading-relaxed text-slate-600" data-print="footnote">{service.basis}</p> : null}
            </div>
          ) : null
        ) : null}

        {tab === "service" ? (
          serviceSection.loading && !service ? <PanelSkeleton /> :
          serviceSection.error ? <SectionError title="Não foi possível carregar o atendimento" message={serviceSection.error} onRetry={serviceSection.retry} /> :
          service && summary ? (
            <div className="flex min-w-0 flex-col gap-3.5" data-print="panel" role="tabpanel" aria-label="Atendimento">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-print="kpi-grid">
                <Kpi label="Taxa de finalização" value={finishRate === null ? "Sem base" : finishRate.toFixed(1).replace(".", ",") + "%"} delta={finishRateDelta} suffix=" p.p." note="Finalizadas sobre o total" />
                <Kpi label="Primeira resposta" value={durationFromSeconds(summary.firstMessageSeconds)} delta={deltaPercent(summary.firstMessageSeconds, comparison?.firstMessageSeconds)} invert note={summary.firstMessageSample + " conversas com resposta"} />
                <Kpi label="Mensagens" value={numberBR(summary.messages)} delta={deltaPercent(summary.messages, comparison?.messages)} note="Todas as direções" />
                <Kpi label="Atendidas pela IA" value={numberBR(summary.bot)} delta={deltaPercent(summary.bot, comparison?.bot)} note="Modo de atendimento registrado" />
                <Kpi label="Atendidas por humano" value={numberBR(summary.human)} delta={deltaPercent(summary.human, comparison?.human)} note="Modo de atendimento registrado" />
                <Kpi label="Pendentes" value={numberBR(summary.pending)} delta={deltaPercent(summary.pending, comparison?.pending)} note="Aguardando continuidade" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-3.5" data-print="grid-2">
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Composição do atendimento" hint="Distribuição por modo de condução" />
                  <Donut segments={composition} totalLabel="conversas" />
                </section>
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Volume por canal" hint="Em que canais as conversas nasceram" />
                  <HorizontalBars rows={(service.byChannel ?? []).map((row) => ({ label: row.name, value: row.total, fill: networkColor(row.name) ?? undefined }))} />
                </section>
              </div>
              <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                <CardHead title="Desempenho por canal" hint="Volume, abertura e finalização por canal" />
                <DataTable
                  caption="Desempenho por canal"
                  columns={["Canal", "Total", "Abertas", "Pendentes", "Finalizadas", "IA / Bot", "Humano"]}
                  rows={(service.byChannel ?? []).map((row) => [row.name, row.total, row.open, row.pending, row.finished, row.bot, row.human])}
                />
              </section>
              {service.basis ? <p className="m-0 border-t border-dashed border-gray-300 pt-2.5 text-xs leading-relaxed text-slate-600" data-print="footnote">{service.basis}</p> : null}
            </div>
          ) : null
        ) : null}

        {tab === "team" ? (
          serviceSection.loading && !service ? <PanelSkeleton /> :
          serviceSection.error ? <SectionError title="Não foi possível carregar a equipe" message={serviceSection.error} onRetry={serviceSection.retry} /> :
          service ? (
            <div className="flex min-w-0 flex-col gap-3.5" data-print="panel" role="tabpanel" aria-label="Equipe">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-print="kpi-grid">
                <Kpi label="Atendentes" value={numberBR(service.byAgent.length)} note="Com conversas no período" />
                <Kpi label="Setores" value={numberBR(service.byDepartment.length)} note="Com conversas no período" />
                <Kpi label="Maior volume" value={topAgent ? numberBR(topAgent.total) : "0"} note={topAgent ? "Conversas com " + topAgent.name : "Sem registros"} />
                <Kpi label="Média por atendente" value={service.byAgent.length ? (summary ? (summary.total / service.byAgent.length).toFixed(1).replace(".", ",") : "0") : "0"} note="Conversas por atendente" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-3.5" data-print="grid-2">
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Conversas por atendente" hint="Top 8 no período" />
                  <HorizontalBars rows={service.byAgent.map((row) => ({ label: row.name, value: row.total }))} />
                </section>
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Conversas por setor" hint="Top 8 no período" />
                  <HorizontalBars rows={service.byDepartment.map((row) => ({ label: row.name, value: row.total }))} />
                </section>
              </div>
              <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                <CardHead title="Desempenho por atendente" hint={service.byAgent.length + " atendentes com atividade"} />
                <DataTable
                  caption="Desempenho por atendente"
                  columns={["Atendente", "Total", "Abertas", "Pendentes", "Finalizadas", "IA / Bot", "Humano"]}
                  rows={service.byAgent.map((row) => [row.name, row.total, row.open, row.pending, row.finished, row.bot, row.human])}
                />
              </section>
              <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
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
          <div className="flex min-w-0 flex-col gap-3.5" data-print="panel" role="tabpanel" aria-label="CRM e Vendas">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-print="kpi-grid">
                    <Kpi label="Leads no período" value={numberBR(origins.total)} note="Contatos captados" />
                    <Kpi label="Identificados" value={identifiedPct === null ? "Sem base" : identifiedPct.toFixed(0) + "%"} note={origins.identified + " de " + origins.total + " com origem conhecida"} />
                    <Kpi label="Ganhos" value={numberBR(won)} note="Finalizados como ganho" />
                    <Kpi label="Perdas" value={numberBR(lost)} note="Finalizados como perda" />
                    <Kpi label="Em aberto" value={numberBR(open)} note="Ainda em negociação" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-3.5" data-print="grid-2">
                    <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                      <CardHead title="Leads por origem" hint="Canais que trouxeram oportunidades" />
                      <HorizontalBars rows={byOrigin.map((origin) => ({ label: origin.name, value: origin.total, fill: networkColor(origin.name) ?? undefined }))} />
                    </section>
                    <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                      <CardHead title="Leads por etapa" hint="Distribuição no funil" />
                      {origins.stages?.length ? (
                        <div className="flex flex-wrap gap-2" data-print="stage-chips">
                          {origins.stages.map((stage) => (
                            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-slate-600" data-print="stage-chip" key={stage.name}>{stage.name}<strong className="tabular-nums text-slate-950">{numberBR(stage.count)}</strong></span>
                          ))}
                        </div>
                      ) : <EmptyBlock title="Funil sem dados" hint="Nenhum lead com etapa registrada no período." />}
                    </section>
                  </div>
                  <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
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
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead
                    title="Pipelines e etapas"
                    hint="Estrutura comercial ativa · cards por etapa, ganhos e perdas"
                    aside={<span className="inline-flex items-center rounded-full border border-gray-200 bg-zinc-300 px-2.5 py-0.5 text-xs font-bold text-slate-600" data-print="count-pill">{pipelines.length} {pipelines.length === 1 ? "pipeline" : "pipelines"}</span>}
                  />
                  {pipelines.length ? (
                    <div className="flex flex-col gap-3" data-print="pipeline-list">
                      {pipelines.map((pipeline) => {
                        const stages = Array.isArray(pipeline.stages) ? (pipeline.stages as PipelineStage[]) : [];
                        return (
                          <div className="grid gap-2 rounded-lg border border-gray-200 bg-zinc-200 p-3.5" data-print="pipeline" key={pipeline.id}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2.5" data-print="pipeline-head">
                              <strong className="text-sm font-semibold text-slate-950">{pipeline.name}</strong>
                              <span className="text-xs text-slate-600">{pipeline.department?.name ?? "Sem setor vinculado"}{pipeline.template ? " · " + pipeline.template : ""}</span>
                              {(typeof pipeline.won === "number" || typeof pipeline.lost === "number") ? (
                                <span className="ml-auto inline-flex gap-2" data-print="pipeline-outcome">
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-600 bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800" data-print="outcome-won">{"Ganhos "}<strong>{numberBR(pipeline.won ?? 0)}</strong></span>
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-600 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600" data-print="outcome-lost">{"Perdas "}<strong>{numberBR(pipeline.lost ?? 0)}</strong></span>
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2" data-print="stage-chips">
                              {stages.length ? stages.map((stage, index) => {
                                const count = typeof stage.count === "number" ? stage.count : typeof stage.cards === "number" ? stage.cards : null;
                                return (
                                  <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-zinc-200 px-2.5 py-1 text-xs font-semibold text-slate-600" data-print="stage-chip" key={(stage.id ?? "stage") + "-" + index}>
                                    <i className="inline-block h-2.5 w-2.5 rounded-full" data-print="stage-dot" style={{ background: TONE_COLOR[String(stage.tone ?? "")] ?? STAGE_FALLBACK[index % STAGE_FALLBACK.length] }} aria-hidden="true" />
                                    {stage.label ?? stage.id ?? "Etapa " + (index + 1)}
                                    {count !== null ? <strong className="tabular-nums text-slate-950">{numberBR(count)}</strong> : null}
                                  </span>
                                );
                              }) : <span className="text-xs text-slate-600" data-print="pipeline-empty">Pipeline sem etapas configuradas.</span>}
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
              <div className="flex min-w-0 flex-col gap-3.5" data-print="panel" role="tabpanel" aria-label="Financeiro">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-print="kpi-grid">
                  <Kpi label="Faturado" value={currencyBRL(totals.billed)} note="Cobranças válidas no período" />
                  <Kpi label="Recebido" value={currencyBRL(totals.paid)} note={totals.customers + " clientes"} />
                  <Kpi label="Em aberto" value={currencyBRL(totals.open)} note="Aguardando pagamento" />
                  <Kpi label="Vencido" value={currencyBRL(totals.overdue)} note={totals.overdueCount + " cobranças vencidas"} />
                  <Kpi label="Taxa de recebimento" value={finance.collectionRate === null ? "Sem base" : finance.collectionRate.toFixed(1).replace(".", ",") + "%"} note="Recebido sobre o faturado" />
                  <Kpi label="Cobranças" value={numberBR(totals.count)} note="Excluindo canceladas e reembolsadas" />
                </div>
                <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                  <CardHead title="Faturado × Recebido por mês" hint="Evolução da régua de cobrança" />
                  <FinanceLine series={finance.series ?? []} />
                </section>
                <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-3.5" data-print="grid-2">
                  <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                    <CardHead title="Por situação" hint="Status das cobranças" />
                    <DataTable
                      caption="Cobranças por situação"
                      columns={["Situação", "Cobranças", "Valor"]}
                      rows={(finance.byStatus ?? []).map((row) => [STATUS_BR[row.status] ?? row.status, row.count, currencyBRL(row.amount)])}
                    />
                  </section>
                  <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
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
          <div className="flex min-w-0 flex-col gap-3.5" data-print="panel" role="tabpanel" aria-label="IA e Automação">
            <p className="m-0 rounded-lg border border-gray-200 border-l-4 border-l-blue-600 bg-zinc-200 px-3.5 py-2.5 text-xs text-slate-600" data-print="scope-note">Indicadores do painel Véxora — visão atual, não filtrada pelo período selecionado.</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-print="kpi-grid">
                    <Kpi label="Resolvidas pela IA" value={numberBR(resolvedByAi)} note="Conversas concluídas sem humano" />
                    <Kpi label="Taxa de resolução IA" value={(kpis.resolvedByAiPercent ?? 0).toFixed(0) + "%"} note="Sobre conversas concluídas" />
                    <Kpi label="Conversas concluídas" value={numberBR(completed)} note="No período de referência do painel" />
                    <Kpi label="Receita de pagamentos" value={currencyBRL(kpis.revenue ?? 0)} note={(kpis.payments ?? 0) + " pagamentos conciliados"} />
                    <Kpi label="Primeira resposta" value={durationFromSeconds(kpis.firstResponseSeconds)} note="Média das conversas recentes" />
                    <Kpi label="Agentes ativos" value={numberBR(overview.activeAgents ?? 0) + " / " + numberBR(overview.agentsTotal ?? 0)} note="Agentes de IA habilitados" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-3.5" data-print="grid-2">
                    <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                      <CardHead title="IA × Humano" hint="Quem resolveu as conversas concluídas" />
                      <Donut segments={aiSegments} totalLabel="concluídas" />
                    </section>
                    <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
                      <CardHead title="Demanda por hora" hint="Conversas criadas por hora nas últimas 24h" />
                      {overview.hourly && overview.hourly.values.length ? (
                        <HourlyBars labels={overview.hourly.labels} values={overview.hourly.values} peakIndex={overview.hourly.peakIndex} />
                      ) : <EmptyBlock title="Sem volume recente" hint="Nenhuma conversa nas últimas 24 horas." />}
                    </section>
                  </div>
                  {overview.topics?.length ? (
                    <section className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-print="card">
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
    <div className="flex min-w-0 flex-col gap-4 bg-zinc-50 text-slate-950 tabular-nums dark:bg-slate-900 dark:text-slate-100" data-print="print-root">
      <style>{REPORTS_CSS}</style>
      <PanelSkeleton />
      <svg className="absolute" width="0" height="0" aria-hidden="true"><defs><linearGradient id="rw-instagram" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FEDA77" /><stop offset=".25" stopColor="#FD1D1D" /><stop offset=".6" stopColor="#D6249F" /><stop offset="1" stopColor="#833AB4" /></linearGradient></defs></svg>
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
/* Relatórios · contrato de impressão. O visual de tela vive nas utilities TW;
   aqui só permanecem as regras de papel, com seletores data-print. */
@media print{
  @page{size:A4;margin:13mm 12mm}
  html,body{height:auto !important;overflow:visible !important;background:#fff !important}
  aside,header,nav,.mobile-sidebar-backdrop,.operation-notices,.workspace-alerts,.sidebar,.topbar,.persistent-module-tabs,.side-nav,.ai-assistant-panel,.ai-assistant-trigger,.crm-workspace > .crm-heading,.crm-workspace > .crm-command-bar,.crm-workspace > .settings-feedback,.crm-workspace > .crm-form,[data-print~="no-print"]{display:none !important}
  .suite-app{display:block !important;min-height:0 !important;height:auto !important}
  .main-area{display:block !important;height:auto !important;overflow:visible !important;margin:0 !important;padding:0 !important}
  .page-content{display:block !important;overflow:visible !important;padding:0 !important;max-width:none !important;margin:0 !important}
  .settings-workspace,.reports-workspace,.crm-workspace{display:block !important;padding:0 !important;margin:0 !important;gap:0 !important}
  [data-print~="print-only"]{display:flex !important}
  [data-print~="print-root"]{
    display:block;
    --s1:#ffffff;--s2:#f6f7f5;--s3:#eaece7;--hover:#eaece7;
    --tx:#14171a;--tx2:#454f47;--ln:#D8DEE9;--ln2:#c3c8bd;
    --primary:#4338CA;--primary-ink:#0B2740;--primary-contrast:#ffffff;--primary-soft:#E7EFFC;
    --ok:#4338CA;--bad:#B4402E;--warn:#9A5B09;--accent2:#2C7BC4;--ln-soft:#D8DEE9;
    background:#fff !important;color:#14171a !important;
    font-size:10.5pt;gap:8pt !important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  [data-print~="print-cover"]{display:flex !important;align-items:center;gap:12pt;padding-bottom:10pt;margin-bottom:12pt;border-bottom:2.5pt solid #4338CA;break-after:avoid}
  [data-print~="panel"],[data-print~="panels"]{display:block !important}
  [data-print~="panel"] > * + *{margin-top:8pt}
  [data-print~="card"]{box-shadow:none !important;border:1pt solid #D8DEE9 !important;background:#fff !important;break-inside:avoid;page-break-inside:avoid;padding:9pt 11pt !important}
  [data-print~="card-head"]{margin-bottom:6pt}
  [data-print~="card-title"]{font-size:10.5pt}
  [data-print~="card-hint"]{display:none}
  [data-print~="kpi-grid"]{grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:6pt !important}
  [data-print~="kpi-value"]{font-size:15pt !important;white-space:normal !important}
  [data-print~="kpi-label"]{font-size:7pt !important}
  [data-print~="grid-2"]{grid-template-columns:1fr 1fr !important;gap:6pt !important}
  [data-print~="footnote"]{border-top:0.5pt solid #c3c8bd;font-size:7.5pt}
  [data-print~="scope-note"]{border:0.5pt solid #D8DEE9;font-size:8pt}
  [data-print~="table"]{font-size:8pt}
  [data-print~="table"] thead{display:table-header-group}
  [data-print~="table"] tr{break-inside:avoid;page-break-inside:avoid}
  [data-print~="table"] th{background:#f2f3ef !important}
  [data-print~="delta"]{border:0.5pt solid currentColor;background:transparent !important}
  [data-print~="hbar-fill"]{background:#4338CA !important}
  [data-print~="hbar-track"]{background:#eaece7 !important}
  [data-print~="donut-track"]{stroke:#eaece7 !important}
  [data-print~="legend-dot"]{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  [data-print~="legend-dot"][data-print~="dot-billed"]{background:#4338CA !important}
  [data-print~="legend-dot"][data-print~="dot-paid"]{background:#FBBF24 !important}
  [data-print~="line-billed"]{stroke:#4338CA !important}
  [data-print~="line-paid"]{stroke:#FBBF24 !important}
  [data-print~="dot-billed"]{fill:#4338CA !important}
  [data-print~="dot-paid"]{fill:#FBBF24 !important}
  [data-print~="line-area"]{fill:#eef4f0 !important}
  [data-print~="gridline"],[data-print~="hour-bar"]{stroke:#D8DEE9}
  [data-print~="hour-bar"]{fill:#c3c8bd !important}
  [data-print~="hour-peak"]{fill:#4338CA !important}
  [data-print~="hour-peak"],[data-print~="dot-billed"],[data-print~="dot-paid"],[data-print~="stage-dot"],[data-print~="print-mark"]{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1,h2,h3{page-break-after:avoid;break-after:avoid}
}
`;
