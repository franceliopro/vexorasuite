"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { platformLabel } from "./platform-icon";

/** Telefone formatado sem o prefixo "+", no padrão pedido: 55 (66) 99999-9999 */
function phoneBR(phone?: string | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 13 && digits.startsWith("55")) return "55 (" + digits.slice(2, 4) + ") " + digits.slice(4, 9) + "-" + digits.slice(9);
  if (digits.length === 12 && digits.startsWith("55")) return "55 (" + digits.slice(2, 4) + ") " + digits.slice(4, 8) + "-" + digits.slice(8);
  if (digits.length === 11) return "55 (" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
  if (digits.length === 10) return "55 (" + digits.slice(0, 2) + ") " + digits.slice(2, 6) + "-" + digits.slice(6);
  return digits;
}
/** Identidade sutil logo abaixo do nome: telefone formatado, ou @ da rede social */
function contactLine(phone?: string | null, handle?: string | null): string {
  if (handle) return handle;
  return phoneBR(phone) || "";
}

export type OverviewWaitingItem = {
  id: string;
  contactName: string;
  contactId: string | null;
  contactPhone?: string | null;
  contactHandle?: string | null;
  departmentName: string | null;
  channel: string;
  waitingMinutes: number;
};

export type OverviewRecentItem = {
  id: string;
  status: string;
  updatedAt: string;
  createdAt?: string;
  handlingMode?: string | null;
  channel?: string;
  contact: { name: string; id?: string | null; phone?: string | null; handle?: string | null };
};

export type OverviewTeamMember = {
  id: string;
  name: string;
  initials: string;
  openCount: number;
  loadPercent: number;
  departmentName: string | null;
  presence: "active" | "paused";
};

export type OverviewChannel = { label: string; count: number; percent: number };

export type OverviewSnapshot = {
  openConversations: number;
  contacts: number;
  contactsNewWeek?: number;
  activeAgents: number;
  agentsTotal?: number;
  completedConversations: number;
  recent: OverviewRecentItem[];
  waiting?: { total: number; oldestMinutes: number | null; items: OverviewWaitingItem[] };
  team?: OverviewTeamMember[];
  hourly?: { labels: string[]; values: number[]; average: number[]; peakIndex: number | null; peakValue: number };
  topics?: Array<{ label: string; count: number; percent: number; channel?: string }>;
  channels?: OverviewChannel[];
  kpis?: { resolvedByAi: number; resolvedByAiPercent: number; revenue: number; payments: number; firstResponseSeconds: number | null };
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PAD = 10;
const CHART_TOP = 22;
const CHART_BOTTOM = 30;

function waitTone(minutes: number): "mint" | "amber" | "coral" {
  if (minutes <= 2) return "mint";
  if (minutes <= 5) return "amber";
  return "coral";
}

/** Cores das medidas de espera — as mesmas dos três temas, via preset. */
function waitToneClasses(tone: "mint" | "amber" | "coral"): string {
  if (tone === "mint") return "bg-emerald-100 text-emerald-600";
  if (tone === "amber") return "bg-amber-100 text-amber-600";
  return "bg-red-100 text-red-600";
}

function waitText(minutes: number): string {
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function relativeTime(value: string | undefined): string {
  const time = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(time)) return "";
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

function clock(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatResponseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
  return `${Math.floor(hours / 24)}d ${String(hours % 24).padStart(2, "0")}h`;
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.charAt(0) || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) || "" : "";
  return (first + last).toUpperCase() || "?";
}

function chartGeometry(values: number[], average: number[]) {
  const maxValue = Math.max(1, ...values, ...average);
  const x = (index: number) => CHART_PAD + index * ((CHART_WIDTH - CHART_PAD * 2) / 23);
  const y = (value: number) => CHART_TOP + (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM) * (1 - value / maxValue);
  const smooth = (series: number[]) => series.map((value, index) => {
    if (!index) return `M${x(0)},${y(value)}`;
    const previous = series[index - 1] ?? 0;
    const dx = (x(index) - x(index - 1)) / 2;
    return `C${x(index - 1) + dx},${y(previous)} ${x(index) - dx},${y(value)} ${x(index)},${y(value)}`;
  }).join(" ");
  const line = smooth(values);
  const area = `${line} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return { x, y, maxValue, line, area, averageLine: smooth(average) };
}

function ClientAvatar({
  id,
  name,
  className = "relative grid h-ov-avatar w-ov-avatar flex-none place-items-center rounded-full bg-blue-50 text-small font-bold text-blue-800",
}: { id?: string | null; name: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(id ? `/api/backend/contacts/${id}/avatar` : null);
  useEffect(() => { setSrc(id ? `/api/backend/contacts/${id}/avatar` : null); }, [id]);
  return (
    <span className={className} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setSrc(null)} /> : <span className="grid h-full w-full place-items-center">{initialsOf(name)}</span>}
    </span>
  );
}

function WaitRing({ minutes, id, name }: { minutes: number; id: string | null; name: string }) {
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0.05, minutes / 10));
  return (
    <span className="relative grid h-ov-ring w-ov-ring flex-none place-items-center ov-tablet:h-ov-ring-sm ov-tablet:w-ov-ring-sm" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 84 84">
        <circle className="fill-none stroke-blue-100 stroke-ov" cx="42" cy="42" r={radius} />
        <circle className="fill-none stroke-blue-600 stroke-ov transition-stroke duration-ring ease-token" cx="42" cy="42" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </svg>
      <ClientAvatar id={id} name={name} className="grid h-ov-ring-photo w-ov-ring-photo place-items-center overflow-hidden rounded-full bg-blue-50 text-2xs font-extrabold text-blue-800 ov-tablet:h-ov-ring-photo-sm ov-tablet:w-ov-ring-photo-sm" />
    </span>
  );
}

function HourlyChart({ hourly }: { hourly: NonNullable<OverviewSnapshot["hourly"]> }) {
  const values = hourly.values.length === 24 ? hourly.values : Array(24).fill(0);
  const average = hourly.average.length === 24 ? hourly.average : Array(24).fill(0);
  const geometry = chartGeometry(values, average);
  const peak = hourly.peakIndex;
  const total = values.reduce((sum, value) => sum + value, 0);
  const ticks = [0, 0.5, 1];
  return (
    <div className="grid min-w-0 gap-3">
      <svg className="h-auto w-full" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`Atendimentos por hora nas últimas 24 horas${peak !== null ? `, pico às ${hourly.labels[peak]} com ${hourly.peakValue} atendimentos` : ""}`}>
        <defs>
          <linearGradient id="vxHourlyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity=".32" />
            <stop offset=".6" stopColor="var(--accent2)" stopOpacity=".12" />
            <stop offset="1" stopColor="var(--accent2)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="vxHourlyStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--accent2)" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const value = geometry.maxValue * tick;
          return <line key={tick} x1={CHART_PAD} x2={CHART_WIDTH - CHART_PAD} y1={geometry.y(value)} y2={geometry.y(value)} className="fill-none stroke-gray-200 stroke-1" />;
        })}
        <path d={geometry.area} fill="url(#vxHourlyFill)" />
        <path d={geometry.averageLine} className="fill-none stroke-slate-400 stroke-2" strokeDasharray="5 5" />
        <path d={geometry.line} className="fill-none stroke-blue-600 stroke-2" stroke="url(#vxHourlyStroke)" />
        {peak !== null ? (
          <g>
            <line x1={geometry.x(peak)} x2={geometry.x(peak)} y1={geometry.y(values[peak]) + 8} y2={geometry.y(0)} className="stroke-blue-600 stroke-1" />
            <circle cx={geometry.x(peak)} cy={geometry.y(values[peak])} r="6.5" className="fill-blue-600 stroke-none" />
          </g>
        ) : null}
        {[0, 6, 12, 18, 23].map((index) => (
          <text key={index} x={geometry.x(index)} y={CHART_HEIGHT - 8} textAnchor={index === 0 ? "start" : index === 23 ? "end" : "middle"} className="fill-slate-400 text-ov-micro">
            {hourly.labels[index]}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ov-micro text-slate-600">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0 w-4 border-t-2 border-blue-600" />Últimas 24 h · {total} {total === 1 ? "atendimento" : "atendimentos"}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0 w-4 border-t-2 border-dashed border-slate-400" />Média dos 7 dias anteriores</span>
        {peak !== null ? <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-bold text-blue-800"><Sparkles size={13} aria-hidden="true" />Pico às {hourly.labels[peak]}: {hourly.peakValue}</span> : null}
      </div>
    </div>
  );
}

function recentLabel(item: OverviewRecentItem): string {
  if (/RESOLVED|CLOSED/i.test(item.status)) return "Finalizado";
  if (String(item.handlingMode || "").toUpperCase() === "BOT") return "Com a IA";
  return `Nova ${relativeTime(item.createdAt || item.updatedAt)}`;
}

export function OverviewIntelligence({ data, onOpenQueue }: { data: OverviewSnapshot | null; onOpenQueue: () => void }) {
  const waiting = data?.waiting;
  const team = data?.team || [];
  const recent = data?.recent || [];
  const topics = data?.topics || [];
  const kpis = data?.kpis;
  const hourly = data?.hourly;
  const waitingTotal = waiting?.total || 0;
  const oldest = waiting?.oldestMinutes ?? null;
  const topicMax = topics.reduce((max, topic) => Math.max(max, topic.percent), 0) || 1;
  const agentsTotal = data?.agentsTotal ?? null;
  const agentsPaused = team.filter((member) => member.presence === "paused").length;
  const staleWaiting = (waiting?.items || []).filter((item) => item.waitingMinutes > 5).length;
  const outOfSla = (waiting?.items || []).filter((item) => item.waitingMinutes >= 10).length;
  const outOfSlaNote = outOfSla || staleWaiting;

  return (
    <section className="grid grid-cols-2 gap-ov-section ov-laptop:grid-cols-1" aria-label="Inteligência da operação">
      <article className="relative col-span-2 grid gap-ov-section overflow-hidden rounded-token-lg border border-gray-200 bg-zinc-100 p-5 text-slate-950 ov-laptop:col-span-1" data-testid="ov-hero">
        <div className="grid grid-cols-ov-hero-body items-start gap-ov-section ov-tablet:grid-cols-1">
          <div className="grid min-w-0 content-start gap-4">
            <h2 className="max-w-ov-heading text-ov-hero font-heading text-slate-950 ov-mobile:text-ov-hero-sm">{waitingTotal ? `${waitingTotal} ${waitingTotal === 1 ? "conversa espera" : "conversas esperam"} por uma pessoa` : "Nenhuma conversa esperando agora"}</h2>
            <p className="max-w-ov-sub text-ov-sub text-slate-600">
              {waitingTotal
                ? oldest !== null && oldest > 0
                  ? `A mais antiga espera há ${waitText(oldest)}. O anel fecha quando o SLA de 15 minutos termina.`
                  : "A fila acabou de começar. Os anéis mostram o tempo de espera de cada conversa."
                : "A fila está em dia. Quando alguém precisar de uma pessoa, a conversa aparece aqui com o tempo de espera."}
            </p>
            <button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-transparent bg-linear-to-br from-blue-50 via-blue-600 to-blue-700 px-4 text-xs font-bold text-blue-900 shadow-token-sm transition-colors hover:from-blue-100 hover:via-blue-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 justify-self-start" onClick={onOpenQueue}>Abrir a fila <ArrowRight size={15} aria-hidden="true" /></button>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2 ov-tablet:justify-start">
            {(waiting?.items || []).slice(0, 3).map((item) => (
              <button type="button" className="grid w-ov-ring-tile flex-none justify-items-center gap-1 rounded-token-lg border border-gray-200 bg-zinc-200 px-2 py-3.5 text-center transition-control duration-control hover:-translate-y-px hover:bg-zinc-300" key={item.id} onClick={onOpenQueue} title={`${item.contactName} · espera ${waitText(item.waitingMinutes)}`}>
                <WaitRing minutes={item.waitingMinutes} id={item.contactId} name={item.contactName} />
                <b className="w-full truncate text-body font-bold text-slate-950">{item.contactName}</b>
                <small className="block w-full truncate text-ov-micro font-semibold text-slate-600">{contactLine(item.contactPhone, item.contactHandle) || (item.channel ? platformLabel(item.channel) : "Sem telefone")}</small>
                <span className={`mt-0.5 rounded-full px-2 py-0.5 text-ov-micro font-bold tabular-nums ${waitToneClasses(waitTone(item.waitingMinutes))}`}>{waitText(item.waitingMinutes)}</span>
              </button>
            ))}
            {!waitingTotal ? (
              <div className="grid justify-items-center gap-1 rounded-token-lg border border-dashed border-gray-200 bg-zinc-200 p-4 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-800"><Sparkles size={22} aria-hidden="true" /></span>
                <strong className="text-body font-bold text-slate-950">Tudo atendido</strong>
                <small className="text-small text-slate-600">Sem conversas aguardando uma pessoa.</small>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 pt-3 text-small text-slate-600">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-100 text-emerald-600" />Até 2 min</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-amber-100 text-amber-600" />De 2 a 5 min</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-red-100 text-red-600" />Acima de 5 min</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-slate-400">Anel cheio: 10 min</span>
        </div>
      </article>

      <div className="col-span-2 grid grid-cols-3 gap-ov-section ov-laptop:col-span-1 ov-mobile:grid-cols-1 xl:grid-cols-6" role="group" aria-label="Resumo da operação">
        <article className="grid min-w-0 content-start gap-2 rounded-token-lg border border-gray-200 bg-zinc-200 p-5">
          <span className="text-small font-semibold text-slate-600">Conversas abertas</span>
          <strong className="text-ov-kpi font-heading tabular-nums text-slate-950">{data?.openConversations ?? "—"}</strong>
          <em className={`inline-flex items-center gap-1.5 text-ov-micro font-semibold ${outOfSlaNote ? "text-red-600" : "text-slate-600"}`}>{outOfSlaNote ? <><span className="inline-block h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />{outOfSlaNote} fora do SLA</> : <><span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />Nenhuma fora do SLA</>}</em>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-token-lg border border-gray-200 bg-zinc-200 p-5">
          <span className="text-small font-semibold text-slate-600">Contatos</span>
          <strong className="text-ov-kpi font-heading tabular-nums text-slate-950">{data?.contacts ?? "—"}</strong>
          <em className="inline-flex items-center gap-1.5 text-ov-micro font-semibold text-slate-600"><span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />{data?.contactsNewWeek ? `${data.contactsNewWeek} novos esta semana` : "Cadastros desta empresa"}</em>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-token-lg border border-gray-200 bg-zinc-200 p-5">
          <span className="text-small font-semibold text-slate-600">Agentes ativos</span>
          <strong className="text-ov-kpi font-heading tabular-nums text-slate-950">{agentsTotal !== null ? <>{data?.activeAgents ?? 0}<small className="text-small font-semibold text-slate-600"> de {agentsTotal}</small></> : (data?.activeAgents ?? "—")}</strong>
          <em className="inline-flex items-center gap-1.5 text-ov-micro font-semibold text-slate-600"><span className="inline-block h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />{agentsPaused === 1 ? "1 em pausa" : agentsPaused > 1 ? `${agentsPaused} em pausa` : "Todos ativos"}</em>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-token-lg border border-gray-200 bg-zinc-200 p-5">
          <span className="text-small font-semibold text-slate-600">Atendimentos finalizados</span>
          <strong className="text-ov-kpi font-heading tabular-nums text-slate-950">{data?.completedConversations ?? "-"}</strong>
          <em className="inline-flex items-center gap-1.5 text-ov-micro font-semibold text-slate-600"><span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />{kpis ? `${kpis.resolvedByAiPercent}% resolvidos pela IA` : "Sem dados ainda"}</em>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-token-lg border border-gray-200 bg-zinc-200 p-5">
          <span className="text-small font-semibold text-slate-600">Receita do mês</span>
          <strong className="text-ov-kpi font-heading tabular-nums text-slate-950">{kpis && kpis.revenue > 0 ? `R$ ${kpis.revenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "-"}</strong>
          <em className="inline-flex items-center gap-1.5 text-ov-micro font-semibold text-slate-600"><span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />{kpis ? `${kpis.payments} ${kpis.payments === 1 ? "pagamento confirmado" : "pagamentos confirmados"}` : "Asaas ainda sem dados"}</em>
        </article>
        <article className="grid min-w-0 content-start gap-2 rounded-token-lg border border-gray-200 bg-zinc-200 p-5">
          <span className="text-small font-semibold text-slate-600">1ª resposta</span>
          <strong className="text-ov-kpi font-heading tabular-nums text-slate-950">{kpis && kpis.firstResponseSeconds !== null && kpis.firstResponseSeconds !== undefined ? formatResponseTime(kpis.firstResponseSeconds) : "-"}</strong>
          <em className="inline-flex items-center gap-1.5 text-ov-micro font-semibold text-slate-600"><span className="inline-block h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />Média dos últimos 30 dias</em>
        </article>
      </div>

      <article className="grid content-start gap-4 rounded-token-lg border border-gray-200 bg-zinc-100 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-h2 font-heading text-slate-950">Equipe agora</h2><p className="mt-0.5 text-small text-slate-600">Quem está atendendo neste momento</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-300 px-2.5 py-1 text-ov-micro font-bold text-slate-600"><Users size={13} aria-hidden="true" />{team.length}</span></header>
        {team.length ? (
          <ul className="grid gap-3">
            {team.map((member) => (
              <li key={member.id} className="grid grid-cols-ov-team-row items-center gap-2.5">
                <span className="relative grid h-ov-avatar w-ov-avatar flex-none place-items-center rounded-full bg-blue-50 text-small font-bold text-blue-800">
                  {member.initials || initialsOf(member.name)}
                  <i className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-200 ${member.presence === "paused" ? "bg-amber-600" : "bg-emerald-600"}`} aria-hidden="true" />
                </span>
                <span className="grid min-w-0"><b className="truncate text-small font-bold text-slate-950">{member.name}</b><small className="truncate text-ov-micro text-slate-600">{member.departmentName || (member.presence === "paused" ? "Em pausa" : "Atendimento")}</small></span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-300" aria-hidden="true"><i className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.max(6, Math.min(100, member.loadPercent))}%` }} /></span>
                <span className="text-right text-small font-bold tabular-nums text-slate-950">{member.openCount}</span>
              </li>
            ))}
          </ul>
        ) : <p className="py-6 text-center text-small text-slate-600">Nenhum atendente com conversa aberta agora.</p>}
        <p className="border-t border-gray-200 pt-2.5 text-ov-micro text-slate-600">Véxora Intelligence Engine · IA · {kpis ? `${kpis.resolvedByAi} ${kpis.resolvedByAi === 1 ? "conversa resolvida" : "conversas resolvidas"} pela IA` : "sem dados ainda"}</p>
      </article>

      <article className="grid content-start gap-4 rounded-token-lg border border-gray-200 bg-zinc-100 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-h2 font-heading text-slate-950">Atividade recente</h2><p className="mt-0.5 text-small text-slate-600">Movimentações da sua operação</p></div>
          <button type="button" className="inline-flex min-h-8 items-center justify-center gap-2 px-1.5 text-body font-bold text-blue-600 transition-colors hover:bg-zinc-200 hover:text-blue-700" onClick={onOpenQueue}>Ver atendimento <ArrowRight size={13} aria-hidden="true" /></button>
        </header>
        {recent.length ? (
          <ul className="grid gap-3">
            {recent.slice(0, 6).map((item) => (
              <li className="grid grid-cols-ov-activity-row items-center gap-2.5" key={item.id}>
                <ClientAvatar id={item.contact.id ?? null} name={item.contact.name} className="grid h-ov-avatar w-ov-avatar flex-none place-items-center overflow-hidden rounded-full bg-blue-50 text-ov-micro font-bold text-blue-800" />
                <span className="grid min-w-0"><b className="truncate text-small font-bold text-slate-950">{item.contact.name}</b><small className="block truncate text-ov-micro text-slate-600">{contactLine(item.contact.phone, item.contact.handle) || (item.channel ? platformLabel(item.channel) : "")}{contactLine(item.contact.phone, item.contact.handle) ? " · " : ""}{recentLabel(item)}</small></span>
                <time className="text-ov-micro tabular-nums text-slate-400">{clock(item.updatedAt)}</time>
              </li>
            ))}
          </ul>
        ) : <p className="py-6 text-center text-small text-slate-600">Os atendimentos desta empresa aparecerão aqui.</p>}
      </article>

      <article className="grid content-start gap-4 rounded-token-lg border border-gray-200 bg-zinc-100 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-h2 font-heading text-slate-950">Atendimentos por hora</h2><p className="mt-0.5 text-small text-slate-600">Últimas 24 horas. A linha tracejada é a média dos 7 dias anteriores.</p></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-ov-micro font-bold text-blue-800"><Sparkles size={13} aria-hidden="true" />Tempo real</span>
        </header>
        {hourly ? <HourlyChart hourly={hourly} /> : <p className="py-6 text-center text-small text-slate-600">Aguardando os primeiros atendimentos.</p>}
      </article>

      <article className="grid content-start gap-4 rounded-token-lg border border-gray-200 bg-zinc-100 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-h2 font-heading text-slate-950">Do que as pessoas falam</h2><p className="mt-0.5 text-small text-slate-600">Assuntos dos últimos 30 dias</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-300 px-2.5 py-1 text-ov-micro font-bold text-slate-600">Top {topics.length || 0}</span></header>
        {topics.length ? (
          <div className="grid grid-cols-ov-topics gap-4 ov-tablet:grid-cols-1">
            {topics.map((topic) => {
              const channel = topic.channel || "";
              return (
              <div className="grid min-w-0 content-start gap-1.5" key={topic.label}>
                <div className="flex items-center justify-between gap-2"><span className="inline-flex min-w-0 items-center gap-1.5 text-small font-semibold text-slate-950"><i className="inline-block h-2 w-2 flex-none rounded-full bg-blue-600" />{topic.label}{channel ? <small className="text-ov-micro font-bold uppercase tracking-ov-wide text-slate-400">{platformLabel(channel)}</small> : null}</span><b className="text-small font-bold tabular-nums text-slate-950">{topic.percent}%</b></div>
                <span className="block h-1.5 overflow-hidden rounded-full bg-zinc-300"><i className="block h-full rounded-full bg-linear-to-r from-blue-600 to-sky-600" style={{ width: `${Math.max(6, (topic.percent / topicMax) * 100)}%` }} /></span>
                <small className="text-ov-micro text-slate-600">{topic.count} {topic.count === 1 ? "conversa" : "conversas"}</small>
              </div>
              );
            })}
          </div>
        ) : <p className="py-6 text-center text-small text-slate-600">Os assuntos aparecem aqui conforme as conversas chegam.</p>}
      </article>

    </section>
  );
}
