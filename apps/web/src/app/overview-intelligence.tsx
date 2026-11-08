"use client";
import type { CSSProperties } from "react";
import { ArrowRight, Bot, CircleDollarSign, Hourglass, Sparkles, Timer, Users } from "lucide-react";

export type OverviewWaitingItem = {
  id: string;
  contactName: string;
  departmentName: string | null;
  channel: string;
  waitingMinutes: number;
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

export type OverviewSnapshot = {
  openConversations: number;
  contacts: number;
  activeAgents: number;
  completedConversations: number;
  recent: Array<{ id: string; status: string; updatedAt: string; contact: { name: string } }>;
  waiting?: { total: number; oldestMinutes: number | null; items: OverviewWaitingItem[] };
  team?: OverviewTeamMember[];
  hourly?: { labels: string[]; values: number[]; average: number[]; peakIndex: number | null; peakValue: number };
  topics?: Array<{ label: string; count: number; percent: number }>;
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

function waitText(minutes: number): string {
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatDuration(seconds: number | null | undefined): { value: string; unit: string } {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return { value: "—", unit: "" };
  if (seconds < 60) return { value: String(Math.max(0, Math.round(seconds))), unit: "s" };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { value: `${minutes} min ${Math.round(seconds % 60)}`, unit: "s" };
  const hours = Math.floor(minutes / 60);
  return { value: `${hours} h ${minutes % 60}`, unit: "min" };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value || 0);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
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

function WaitRing({ minutes }: { minutes: number }) {
  const tone = waitTone(minutes);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0.04, minutes / 10));
  return (
    <span className={`vx-wait-ring tone-${tone}`} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle className="vx-wait-track" cx="32" cy="32" r={radius} />
        <circle className="vx-wait-progress" cx="32" cy="32" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </svg>
      <span className="vx-wait-core">{waitText(minutes)}</span>
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
    <div className="vx-chart-wrap">
      <svg className="vx-chart-svg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`Atendimentos por hora nas últimas 24 horas${peak !== null ? `, pico às ${hourly.labels[peak]} com ${hourly.peakValue} atendimentos` : ""}`}>
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
          return <line key={tick} x1={CHART_PAD} x2={CHART_WIDTH - CHART_PAD} y1={geometry.y(value)} y2={geometry.y(value)} className="vx-chart-grid" />;
        })}
        <path d={geometry.area} fill="url(#vxHourlyFill)" />
        <path d={geometry.averageLine} className="vx-chart-average" />
        <path d={geometry.line} className="vx-chart-line" stroke="url(#vxHourlyStroke)" />
        {peak !== null ? (
          <g className="vx-chart-peak">
            <line x1={geometry.x(peak)} x2={geometry.x(peak)} y1={geometry.y(values[peak]) + 8} y2={geometry.y(0)} />
            <circle cx={geometry.x(peak)} cy={geometry.y(values[peak])} r="6.5" />
          </g>
        ) : null}
        {[0, 6, 12, 18, 23].map((index) => (
          <text key={index} x={geometry.x(index)} y={CHART_HEIGHT - 8} textAnchor={index === 0 ? "start" : index === 23 ? "end" : "middle"} className="vx-chart-label">
            {hourly.labels[index]}
          </text>
        ))}
      </svg>
      <div className="vx-chart-meta">
        <span><i className="vx-legend-line primary" />Últimas 24 h · {total} {total === 1 ? "atendimento" : "atendimentos"}</span>
        <span><i className="vx-legend-line dashed" />Média dos 7 dias anteriores</span>
        {peak !== null ? <span className="vx-chart-peak-chip"><Sparkles size={13} aria-hidden="true" />Pico às {hourly.labels[peak]}: {hourly.peakValue}</span> : null}
      </div>
    </div>
  );
}

export function OverviewIntelligence({ data, onOpenQueue }: { data: OverviewSnapshot | null; onOpenQueue: () => void }) {
  const waiting = data?.waiting;
  const team = data?.team || [];
  const topics = data?.topics || [];
  const kpis = data?.kpis;
  const hourly = data?.hourly;
  const waitingTotal = waiting?.total || 0;
  const oldest = waiting?.oldestMinutes ?? null;
  const firstResponse = formatDuration(kpis?.firstResponseSeconds);
  const topicMax = topics.reduce((max, topic) => Math.max(max, topic.percent), 0) || 1;

  return (
    <section className="vx-overview" aria-label="Inteligência da operação">
      <article className={`vx-hero${waitingTotal ? "" : " is-clear"}`}>
        <div className="vx-hero-body">
          <div className="vx-hero-copy">
            <span className="vx-eyebrow"><span className="vx-live-dot" aria-hidden="true" />Fila ao vivo</span>
            <h2>{waitingTotal ? `${waitingTotal} ${waitingTotal === 1 ? "conversa espera" : "conversas esperam"} por uma pessoa` : "Nenhuma conversa esperando agora"}</h2>
            <p className="vx-hero-sub">
              {waitingTotal
                ? oldest !== null && oldest > 0 ? `A mais antiga espera há ${waitText(oldest)}. O anel enche conforme o tempo passa.` : "A fila acabou de começar. Os anéis mostram o tempo de espera de cada conversa."
                : "A fila está em dia. Quando alguém precisar de uma pessoa, a conversa aparece aqui com o tempo de espera."}
            </p>
            <button type="button" className="primary-button" onClick={onOpenQueue}>Abrir a fila <ArrowRight size={15} aria-hidden="true" /></button>
          </div>
          <div className="vx-rings">
            {(waiting?.items || []).map((item) => (
              <button type="button" className="vx-ring-card" key={item.id} onClick={onOpenQueue} title={`${item.contactName} · espera ${waitText(item.waitingMinutes)}`}>
                <WaitRing minutes={item.waitingMinutes} />
                <b>{item.contactName}</b>
                <span className={`vx-ring-time tone-${waitTone(item.waitingMinutes)}`}>{waitText(item.waitingMinutes)}</span>
                <small>{item.departmentName || item.channel}</small>
              </button>
            ))}
            {!waitingTotal ? (
              <div className="vx-hero-clear">
                <span className="vx-hero-clear-icon"><Sparkles size={22} aria-hidden="true" /></span>
                <strong>Tudo atendido</strong>
                <small>Sem conversas aguardando uma pessoa.</small>
              </div>
            ) : null}
          </div>
        </div>
        <div className="vx-hero-legend">
          <span><i className="vx-dot mint" />Até 2 min</span>
          <span><i className="vx-dot amber" />De 2 a 5 min</span>
          <span><i className="vx-dot coral" />Acima de 5 min</span>
          <span className="vx-hero-legend-end">Anel cheio: 10 min</span>
        </div>
      </article>

      <div className="vx-kpis" aria-label="Indicadores inteligentes">
        <article className="vx-kpi">
          <span className="vx-kpi-icon tone-coral"><Hourglass size={17} aria-hidden="true" /></span>
          <span className="vx-kpi-label">Em espera</span>
          <strong className="vx-kpi-value">{waitingTotal}</strong>
          <em>{oldest !== null && oldest > 0 ? `mais antiga há ${waitText(oldest)}` : "fila em dia"}</em>
        </article>
        <article className="vx-kpi">
          <span className="vx-kpi-icon tone-blue"><Timer size={17} aria-hidden="true" /></span>
          <span className="vx-kpi-label">Primeira resposta</span>
          <strong className="vx-kpi-value">{firstResponse.value}<small>{firstResponse.unit}</small></strong>
          <em>média dos últimos 30 dias</em>
        </article>
        <article className="vx-kpi">
          <span className="vx-kpi-icon tone-violet"><Bot size={17} aria-hidden="true" /></span>
          <span className="vx-kpi-label">Resolvidas pela IA</span>
          <strong className="vx-kpi-value">{kpis ? kpis.resolvedByAiPercent : 0}<small>%</small></strong>
          <em>{kpis ? `${kpis.resolvedByAi} de ${data?.completedConversations ?? 0} finalizadas` : "sem dados ainda"}</em>
        </article>
        <article className="vx-kpi">
          <span className="vx-kpi-icon tone-mint"><CircleDollarSign size={17} aria-hidden="true" /></span>
          <span className="vx-kpi-label">Vendas atribuídas</span>
          <strong className="vx-kpi-value vx-kpi-money">{formatMoney(kpis?.revenue || 0)}</strong>
          <em>{kpis ? `${kpis.payments} ${kpis.payments === 1 ? "pagamento confirmado" : "pagamentos confirmados"}` : "sem pagamentos confirmados"}</em>
        </article>
      </div>

      <article className="content-card vx-chart-card">
        <header className="vx-card-head">
          <div><h2>Atendimentos por hora</h2><p>Últimas 24 horas. A linha tracejada é a média dos 7 dias anteriores.</p></div>
          <span className="vx-card-badge"><Sparkles size={13} aria-hidden="true" />Tempo real</span>
        </header>
        {hourly ? <HourlyChart hourly={hourly} /> : <p className="vx-card-empty">Aguardando os primeiros atendimentos.</p>}
      </article>

      <article className="content-card vx-team-card">
        <header className="vx-card-head"><div><h2>Equipe agora</h2><p>Quem está atendendo neste momento</p></div><span className="vx-card-badge neutral"><Users size={13} aria-hidden="true" />{team.length}</span></header>
        {team.length ? (
          <ul className="vx-team-list">
            {team.map((member, index) => (
              <li key={member.id} className="vx-team-row">
                <span className="vx-team-avatar" style={{ "--i": index } as CSSProperties}>
                  {member.initials || initialsOf(member.name)}
                  <i className={`vx-presence ${member.presence}`} aria-hidden="true" />
                </span>
                <span className="vx-team-copy"><b>{member.name}</b><small>{member.departmentName || "Atendimento"}</small></span>
                <span className="vx-team-load" aria-hidden="true"><i style={{ width: `${member.loadPercent}%` }} /></span>
                <span className="vx-team-count">{member.openCount}</span>
              </li>
            ))}
          </ul>
        ) : <p className="vx-card-empty">Nenhum atendente com conversa aberta agora.</p>}
      </article>

      <article className="content-card vx-topics-card">
        <header className="vx-card-head"><div><h2>Do que as pessoas falam</h2><p>Assuntos dos últimos 30 dias</p></div><span className="vx-card-badge neutral">Top {topics.length || 0}</span></header>
        {topics.length ? (
          <div className="vx-topics">
            {topics.map((topic, index) => (
              <div className="vx-topic" key={topic.label}>
                <div className="vx-topic-top"><span><i className={`vx-topic-dot tone-${["mint", "blue", "violet", "amber", "coral"][index % 5]}`} />{topic.label}</span><b>{topic.percent}%</b></div>
                <span className="vx-topic-bar"><i style={{ width: `${Math.max(6, (topic.percent / topicMax) * 100)}%`, "--i": index } as CSSProperties} /></span>
                <small>{topic.count} {topic.count === 1 ? "conversa" : "conversas"}</small>
              </div>
            ))}
          </div>
        ) : <p className="vx-card-empty">Os assuntos aparecem aqui conforme as conversas chegam.</p>}
      </article>
    </section>
  );
}
