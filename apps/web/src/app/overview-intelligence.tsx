"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Sparkles, Users } from "lucide-react";

export type OverviewWaitingItem = {
  id: string;
  contactName: string;
  contactId: string | null;
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
  contact: { name: string; id?: string | null };
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
  topics?: Array<{ label: string; count: number; percent: number }>;
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

function ClientAvatar({ id, name, className = "vx-avatar" }: { id?: string | null; name: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(id ? `/api/backend/contacts/${id}/avatar` : null);
  useEffect(() => { setSrc(id ? `/api/backend/contacts/${id}/avatar` : null); }, [id]);
  return (
    <span className={className} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setSrc(null)} /> : <span className="vx-avatar-fallback">{initialsOf(name)}</span>}
    </span>
  );
}

function WaitRing({ minutes, id, name }: { minutes: number; id: string | null; name: string }) {
  const tone = waitTone(minutes);
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0.05, minutes / 10));
  return (
    <span className={`vx-ring tone-${tone}`} aria-hidden="true">
      <svg viewBox="0 0 84 84">
        <circle className="vx-ring-track" cx="42" cy="42" r={radius} />
        <circle className="vx-ring-progress" cx="42" cy="42" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
      </svg>
      <ClientAvatar id={id} name={name} className="vx-ring-photo" />
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

function recentLabel(item: OverviewRecentItem): string {
  if (/RESOLVED|CLOSED/i.test(item.status)) return "Finalizado";
  if (String(item.handlingMode || "").toUpperCase() === "BOT") return "Com a IA";
  return `Nova ${relativeTime(item.createdAt || item.updatedAt)}`;
}

export function OverviewIntelligence({ data, onOpenQueue, shortcuts }: { data: OverviewSnapshot | null; onOpenQueue: () => void; shortcuts?: ReactNode }) {
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
    <section className="vx-overview" aria-label="Inteligência da operação">
      <div className="vx-primary-row">
        <article className={`vx-hero${waitingTotal ? "" : " is-clear"}`}>
          <div className="vx-hero-body">
            <div className="vx-hero-copy">
              <h2>{waitingTotal ? `${waitingTotal} ${waitingTotal === 1 ? "conversa espera" : "conversas esperam"} por uma pessoa` : "Nenhuma conversa esperando agora"}</h2>
              <p className="vx-hero-sub">
                {waitingTotal
                  ? oldest !== null && oldest > 0
                    ? `A mais antiga espera há ${waitText(oldest)}. O anel fecha quando o SLA de 15 minutos termina.`
                    : "A fila acabou de começar. Os anéis mostram o tempo de espera de cada conversa."
                  : "A fila está em dia. Quando alguém precisar de uma pessoa, a conversa aparece aqui com o tempo de espera."}
              </p>
              <button type="button" className="primary-button" onClick={onOpenQueue}>Abrir a fila <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
            <div className="vx-rings">
              {(waiting?.items || []).slice(0, 3).map((item) => (
                <button type="button" className="vx-ring-card" key={item.id} onClick={onOpenQueue} title={`${item.contactName} · espera ${waitText(item.waitingMinutes)}`}>
                  <WaitRing minutes={item.waitingMinutes} id={item.contactId} name={item.contactName} />
                  <b>{item.contactName}</b>
                  <span className={`vx-ring-time tone-${waitTone(item.waitingMinutes)}`}>{waitText(item.waitingMinutes)}</span>
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

        <article className="content-card vx-team-card">
          <header className="vx-card-head"><div><h2>Equipe agora</h2><p>Quem está atendendo neste momento</p></div><span className="vx-card-badge neutral"><Users size={13} aria-hidden="true" />{team.length}</span></header>
          {team.length ? (
            <ul className="vx-team-list">
              {team.map((member) => (
                <li key={member.id} className="vx-team-row">
                  <span className="vx-team-avatar">
                    {member.initials || initialsOf(member.name)}
                    <i className={`vx-presence ${member.presence}`} aria-hidden="true" />
                  </span>
                  <span className="vx-team-copy"><b>{member.name}</b><small>{member.departmentName || (member.presence === "paused" ? "Em pausa" : "Atendimento")}</small></span>
                  <span className="vx-team-load" aria-hidden="true"><i style={{ width: `${Math.max(6, Math.min(100, member.loadPercent))}%` }} /></span>
                  <span className="vx-team-count">{member.openCount}</span>
                </li>
              ))}
            </ul>
          ) : <p className="vx-card-empty">Nenhum atendente com conversa aberta agora.</p>}
          <p className="vx-team-foot">Véxora Intelligence Engine · IA · {kpis ? `${kpis.resolvedByAi} ${kpis.resolvedByAi === 1 ? "conversa resolvida" : "conversas resolvidas"} pela IA` : "sem dados ainda"}</p>
        </article>
      </div>

      <div className="vx-kpi-strip" role="group" aria-label="Resumo da operação">
        <article className="vx-kpi-cell">
          <span className="vx-kpi-cell-label">Conversas abertas</span>
          <strong className="vx-kpi-cell-value">{data?.openConversations ?? "—"}</strong>
          <em className={`vx-kpi-cell-note${outOfSlaNote ? " is-warn" : ""}`}>{outOfSlaNote ? <><span className="vx-kpi-dot alert" aria-hidden="true" />{outOfSlaNote} fora do SLA</> : <><span className="vx-kpi-dot ok" aria-hidden="true" />Nenhuma fora do SLA</>}</em>
        </article>
        <article className="vx-kpi-cell">
          <span className="vx-kpi-cell-label">Contatos</span>
          <strong className="vx-kpi-cell-value">{data?.contacts ?? "—"}</strong>
          <em className="vx-kpi-cell-note"><span className="vx-kpi-dot ok" aria-hidden="true" />{data?.contactsNewWeek ? `${data.contactsNewWeek} novos esta semana` : "Cadastros desta empresa"}</em>
        </article>
        <article className="vx-kpi-cell">
          <span className="vx-kpi-cell-label">Agentes ativos</span>
          <strong className="vx-kpi-cell-value">{agentsTotal !== null ? <>{data?.activeAgents ?? 0}<small> de {agentsTotal}</small></> : (data?.activeAgents ?? "—")}</strong>
          <em className="vx-kpi-cell-note"><span className="vx-kpi-dot muted" aria-hidden="true" />{agentsPaused === 1 ? "1 em pausa" : agentsPaused > 1 ? `${agentsPaused} em pausa` : "Todos ativos"}</em>
        </article>
        <article className="vx-kpi-cell">
          <span className="vx-kpi-cell-label">Atendimentos finalizados</span>
          <strong className="vx-kpi-cell-value">{data?.completedConversations ?? "—"}</strong>
          <em className="vx-kpi-cell-note"><span className="vx-kpi-dot ok" aria-hidden="true" />{kpis ? `${kpis.resolvedByAiPercent}% resolvidos pela IA` : "Sem dados ainda"}</em>
        </article>
      </div>

      <div className="vx-main-row">
        <article className="content-card vx-chart-card">
          <header className="vx-card-head">
            <div><h2>Atendimentos por hora</h2><p>Últimas 24 horas. A linha tracejada é a média dos 7 dias anteriores.</p></div>
            <span className="vx-card-badge"><Sparkles size={13} aria-hidden="true" />Tempo real</span>
          </header>
          {hourly ? <HourlyChart hourly={hourly} /> : <p className="vx-card-empty">Aguardando os primeiros atendimentos.</p>}
        </article>

        <article className="content-card vx-activity-card">
          <header className="vx-card-head">
            <div><h2>Atividade recente</h2><p>Movimentações da sua operação</p></div>
            <button type="button" className="text-button" onClick={onOpenQueue}>Ver atendimento <ArrowRight size={13} aria-hidden="true" /></button>
          </header>
          {recent.length ? (
            <ul className="vx-activity-list">
              {recent.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <ClientAvatar id={item.contact.id ?? null} name={item.contact.name} className="vx-activity-avatar" />
                  <span className="vx-activity-copy"><b>{item.contact.name}</b><small>{recentLabel(item)}</small></span>
                  <time className="vx-activity-time">{clock(item.updatedAt)}</time>
                </li>
              ))}
            </ul>
          ) : <p className="vx-card-empty">Os atendimentos desta empresa aparecerão aqui.</p>}
        </article>
      </div>

      <article className="content-card vx-topics-card">
        <header className="vx-card-head"><div><h2>Do que as pessoas falam</h2><p>Assuntos dos últimos 30 dias</p></div><span className="vx-card-badge neutral">Top {topics.length || 0}</span></header>
        {topics.length ? (
          <div className="vx-topics">
            {topics.map((topic, index) => (
              <div className="vx-topic" key={topic.label}>
                <div className="vx-topic-top"><span><i className={`vx-topic-dot tone-${["mint", "blue", "violet", "amber", "coral"][index % 5]}`} />{topic.label}</span><b>{topic.percent}%</b></div>
                <span className="vx-topic-bar"><i style={{ width: `${Math.max(6, (topic.percent / topicMax) * 100)}%` }} /></span>
                <small>{topic.count} {topic.count === 1 ? "conversa" : "conversas"}</small>
              </div>
            ))}
          </div>
        ) : <p className="vx-card-empty">Os assuntos aparecem aqui conforme as conversas chegam.</p>}
      </article>

      {shortcuts}
    </section>
  );
}
