"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";

type OriginGroup = {
  name: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  withCampaign: number;
};
type Lead = {
  id: string;
  name: string;
  source: string;
  campaign: string | null;
  stage: string;
  createdAt: string;
};
type Origins = {
  period: { from: string; to: string };
  total: number;
  identified: number;
  unidentified: number;
  byOrigin: OriginGroup[];
  stages: { name: string; count: number }[];
  recent: Lead[];
  basis: string;
};
const originLabel = (value: string): string => {
  const v = value.toLowerCase();
  if (v.includes("instagram")) return "Instagram";
  if (v.includes("facebook")) return "Facebook";
  if (v.includes("whatsapp")) return "WhatsApp";
  if (v.includes("google")) return "Google";
  if (v.includes("form")) return "Formulário";
  if (v.includes("landing")) return "Landing";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};
const displayName = (item: Lead): string => {
  const name = item.name.trim();
  if (!name) return "Cliente";
  const digits = name.replace(/[^\d]/g, "");
  if (/^[+]?[\d\s().-]{8,}$/.test(name) && digits.length >= 8) return "Cliente";
  return name;
};
const day = 86400000;
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

const ROOT_TW = "grid grid-cols-1 content-start gap-token";
const INTRO_TW = "flex items-end justify-between gap-3 px-0.5 pb-2.5 pt-0.5";
const INTRO_TITLE_TW = "text-h2 font-extrabold tracking-tight";
const INTRO_COPY_TW = "mt-0.5 text-small text-slate-600";
const FILTER_CARD_TW = "flex min-w-0 flex-wrap items-end gap-3 rounded-token border border-line bg-surface p-pad shadow-token";
const FILTER_LABEL_TW = "grid gap-1.5 text-2xs font-extrabold uppercase tracking-widest text-slate-600";
const DATE_INPUT_TW = "min-h-9 w-full rounded-token-sm border border-line bg-surface-2 px-3 text-body font-semibold text-ink";
const ERROR_TW = "rounded-token-sm border border-red-600/40 bg-red-100 px-3 py-2.5 text-small leading-relaxed text-red-600";
const KPI_GRID_TW = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
const KPI_CARD_TW = "relative grid min-w-0 content-start gap-0.5 overflow-hidden rounded-fin-figure border border-line bg-surface p-4 pb-3.5 shadow-token";
const KPI_ACCENT_TW = "absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-blue-600 to-transparent";
const KPI_LABEL_TW = "text-2xs font-extrabold uppercase tracking-widest text-slate-600";
const KPI_VALUE_TW = "text-2xl font-extrabold leading-tight tracking-tight tabular-nums text-ink";
const KPI_NOTE_TW = "text-small text-slate-600";
const MAIN_GRID_TW = "grid grid-cols-1 gap-3 lg:grid-cols-2";
const PANEL_TW = "grid min-w-0 content-start gap-2 rounded-token border border-line bg-surface p-pad shadow-token";
const PANEL_HEADER_TW = "mb-1 flex flex-wrap items-start justify-between gap-2.5 border-b border-line pb-2";
const PANEL_TITLE_TW = "text-body font-extrabold text-ink";
const PANEL_COPY_TW = "mt-0.5 text-xs text-slate-600";
const BAR_ROW_TW = "mt-2.5 grid min-w-0 gap-1.5 rounded-fin-card border border-line bg-surface-2 px-3 py-2.5";
const BAR_LABEL_TW = "flex items-center justify-between gap-2.5 text-body font-bold text-ink";
const BAR_TRACK_TW = "h-2 overflow-hidden rounded-full bg-surface-3";
const BAR_FILL_TW = "block h-full rounded-full";
const BAR_META_TW = "flex flex-wrap gap-x-4 gap-y-1 text-2xs tabular-nums text-slate-600";
const EMPTY_TW = "block rounded-token-sm border border-dashed border-line-strong p-4 text-center text-small text-slate-600";
const STAGE_HEADER_TITLE_TW = "border-b border-line pb-2 text-body font-extrabold text-ink";
const STAGE_ROW_TW = "flex items-center justify-between gap-2.5 rounded-token-sm border border-line bg-surface-2 px-3 py-2 text-body font-semibold text-ink";
const STAGE_COUNT_TW = "text-body font-bold tabular-nums text-ink";
const TIP_TW = "mt-1 rounded-token-sm border border-dashed border-blue-600/30 bg-blue-50 p-3.5";
const TIP_TITLE_TW = "mb-1 block text-2xs font-extrabold uppercase tracking-widest text-blue-800";
const TIP_COPY_TW = "text-xs leading-relaxed text-slate-600";
const RECENT_HEADER_TW = "mb-1 flex flex-wrap items-center justify-between gap-3.5";
const SEARCH_TW = "flex min-h-control flex-nowrap items-center gap-2.5 whitespace-nowrap rounded-token-sm border border-line bg-surface-2 px-3 text-body font-medium text-ink shadow-catalog-sheen transition-colors focus-within:border-blue-600 focus-within:shadow-ring focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus";
const SEARCH_INPUT_TW = "min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-ink shadow-none outline-hidden";
const TABLE_SCROLL_TW = "overflow-x-auto";
const TABLE_TW = "w-full border-collapse whitespace-nowrap text-small text-ink";
const TH_TW = "border-b border-line px-0 pb-2 pr-3 text-left text-2xs font-extrabold uppercase tracking-widest text-slate-600";
const TD_TW = "border-b border-line/60 px-0 py-2.5 pr-3 tabular-nums text-ink";
const BADGE_TW = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-2xs font-extrabold";
const OPEN_LINK_TW = "inline-grid size-8 place-items-center rounded-token-sm border border-line bg-surface text-slate-600 transition-colors hover:border-blue-600/35 hover:text-blue-800";
const METHOD_TW = "max-w-4xl px-0.5 text-2xs leading-relaxed text-slate-600";

/** Cores dos canais são dados do contato, não branding — vivem em `style`, sem hex nas classes. */
type OriginTone = {
  bar: string;
  badgeBackground: string;
  badgeColor: string;
  badgeBorder: string;
};
const ORIGIN_TONES: Record<string, OriginTone> = {
  instagram: {
    bar: "linear-gradient(90deg, hsl(43 98% 73%), hsl(0 99% 55%), hsl(283 72% 45%))",
    badgeBackground: "linear-gradient(135deg, hsl(43 98% 73%) 0%, hsl(0 99% 55%) 35%, hsl(322 71% 49%) 70%, hsl(283 72% 45%) 100%)",
    badgeColor: "hsl(0 0% 100%)",
    badgeBorder: "transparent",
  },
  facebook: {
    bar: "hsl(214 89% 52%)",
    badgeBackground: "hsl(214 89% 52%)",
    badgeColor: "hsl(0 0% 100%)",
    badgeBorder: "hsl(215 87% 44%)",
  },
  whatsapp: {
    bar: "hsl(142 68% 49%)",
    badgeBackground: "hsl(142 68% 49%)",
    badgeColor: "hsl(148 71% 12%)",
    badgeBorder: "hsl(146 70% 39%)",
  },
  google: {
    bar: "hsl(217 89% 61%)",
    badgeBackground: "hsl(0 0% 100%)",
    badgeColor: "hsl(220 5% 24%)",
    badgeBorder: "hsl(216 8% 87%)",
  },
  form: {
    bar: "hsl(34 79% 57%)",
    badgeBackground: "hsl(48 95% 89%)",
    badgeColor: "hsl(32 82% 31%)",
    badgeBorder: "hsl(47 96% 76%)",
  },
  landing: {
    bar: "hsl(258 90% 66%)",
    badgeBackground: "hsl(274 100% 96%)",
    badgeColor: "hsl(271 81% 50%)",
    badgeBorder: "hsl(273 100% 92%)",
  },
  neutral: {
    bar: "hsl(207 14% 60%)",
    badgeBackground: "var(--s3)",
    badgeColor: "var(--tx2)",
    badgeBorder: "var(--ln2)",
  },
};
function originTone(value: string): OriginTone {
  const normalized = value.toLowerCase();
  if (normalized.includes("instagram")) return ORIGIN_TONES.instagram;
  if (normalized.includes("facebook")) return ORIGIN_TONES.facebook;
  if (normalized.includes("whatsapp")) return ORIGIN_TONES.whatsapp;
  if (normalized.includes("google")) return ORIGIN_TONES.google;
  if (normalized.includes("formul")) return ORIGIN_TONES.form;
  if (normalized.includes("landing")) return ORIGIN_TONES.landing;
  return ORIGIN_TONES.neutral;
}
function dateValue(value: Date) {
  return (
    value.getFullYear() +
    "-" +
    String(value.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(value.getDate()).padStart(2, "0")
  );
}
async function request<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Não foi possível carregar as origens.");
  return data as T;
}
export function LeadOriginsWorkspace() {
  const today = dateValue(new Date()),
    initialFrom = dateValue(new Date(Date.now() - 29 * day));
  const [from, setFrom] = useState(initialFrom),
    [to, setTo] = useState(today),
    [applied, setApplied] = useState({ from: initialFrom, to: today }),
    [data, setData] = useState<Origins | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void request<Origins>(
      "/api/backend/reports/lead-origins?" +
        new URLSearchParams({ ...applied, tzOffset: String(new Date().getTimezoneOffset()) }),
    )
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "Falha ao carregar as origens.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [applied]);
  const max = Math.max(1, ...(data?.byOrigin || []).map((item) => item.total));
  const visible = (data?.recent || []).filter(
    (item) =>
      !query.trim() ||
      [item.name, item.source, item.campaign || ""].some((v) =>
        v.toLowerCase().includes(query.trim().toLowerCase()),
      ),
  );
  function apply() {
    if (from && to && from <= to) setApplied({ from, to });
    else setError("Confira as datas do período.");
  }
  return (
    <section className={ROOT_TW}>
      <div className={INTRO_TW}>
        <div>
          <h2 className={INTRO_TITLE_TW}>Aquisição de leads</h2>
          <p className={INTRO_COPY_TW}>Quais canais trazem oportunidades e quais avançam no funil.</p>
        </div>
      </div>
      <section className={FILTER_CARD_TW}>
        <label className={FILTER_LABEL_TW}>
          De
          <input
            className={DATE_INPUT_TW}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className={FILTER_LABEL_TW}>
          Até
          <input
            className={DATE_INPUT_TW}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className={primaryTw} onClick={apply} disabled={loading}>
          Aplicar período
        </button>
      </section>
      {error ? (
        <div className={ERROR_TW} role="alert">
          {error}
        </div>
      ) : null}
      {data ? (
        <>
          <div className={KPI_GRID_TW}>
            {[
              ["Leads no período", data.total],
              ["Origem identificada", data.identified],
              ["Origem não informada", data.unidentified],
            ].map(([label, value]) => (
              <article className={KPI_CARD_TW} key={String(label)}>
                <span className={KPI_ACCENT_TW} aria-hidden="true" />
                <span className={KPI_LABEL_TW}>{label}</span>
                <strong className={KPI_VALUE_TW}>{value}</strong>
                <small className={KPI_NOTE_TW}>
                  {data.total
                    ? Math.round((Number(value) / data.total) * 100) + "% do total"
                    : "Sem contatos neste período"}
                </small>
              </article>
            ))}
          </div>
          <div className={MAIN_GRID_TW}>
            <section className={PANEL_TW}>
              <header className={PANEL_HEADER_TW}>
                <div>
                  <h2 className={PANEL_TITLE_TW}>De onde vêm os contatos</h2>
                  <p className={PANEL_COPY_TW}>Origens registradas no cadastro, com a cor correspondente ao canal.</p>
                </div>
              </header>
              {data.byOrigin.length ? (
                data.byOrigin.map((item) => {
                  const tone = originTone(item.name);
                  return (
                    <div className={BAR_ROW_TW} key={item.name}>
                      <div className={BAR_LABEL_TW}>
                        <span>{originLabel(item.name)}</span>
                        <strong>{item.total}</strong>
                      </div>
                      <div className={BAR_TRACK_TW}>
                        <span
                          className={BAR_FILL_TW}
                          style={{ width: (item.total / max) * 100 + "%", background: tone.bar }}
                        />
                      </div>
                      <div className={BAR_META_TW}>
                        <span>{item.won} ganhos</span>
                        <span>{item.lost} perdas</span>
                        <span>{item.open} em andamento</span>
                        {item.withCampaign ? <span>{item.withCampaign} com campanha</span> : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className={EMPTY_TW}>Ainda não há contatos neste período.</p>
              )}
            </section>
            <section className={PANEL_TW}>
              <header>
                <h2 className={STAGE_HEADER_TITLE_TW}>Etapas comerciais</h2>
              </header>
              {data.stages.length ? (
                data.stages.map((stage) => (
                  <div className={STAGE_ROW_TW} key={stage.name}>
                    <span>{stage.name}</span>
                    <strong className={STAGE_COUNT_TW}>{stage.count}</strong>
                  </div>
                ))
              ) : (
                <p className={EMPTY_TW}>Sem etapas registradas.</p>
              )}
              <div className={TIP_TW}>
                <strong className={TIP_TITLE_TW}>Como melhorar a atribuição</strong>
                <p className={TIP_COPY_TW}>
                  Registre de onde a pessoa conheceu a empresa. A captura automática de site,
                  anúncios e campanhas depende de conectar esses canais.
                </p>
              </div>
            </section>
          </div>
          <section className={PANEL_TW}>
            <header className={RECENT_HEADER_TW}>
              <div>
                <h2 className={PANEL_TITLE_TW}>Contatos recentes</h2>
                <p className={PANEL_COPY_TW}>Até 50 leads criados no período selecionado.</p>
              </div>
              <label className={SEARCH_TW}>
                <Search size={16} />
                <input
                  className={SEARCH_INPUT_TW}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar contato ou origem"
                />
              </label>
            </header>
            {visible.length ? (
              <div className={TABLE_SCROLL_TW}>
                <table className={TABLE_TW}>
                  <thead>
                    <tr>
                      <th className={TH_TW}>Contato</th>
                      <th className={TH_TW}>Origem</th>
                      <th className={TH_TW}>Campanha</th>
                      <th className={TH_TW}>Etapa</th>
                      <th className={TH_TW}>Cadastro</th>
                      <th className={TH_TW}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => {
                      const tone = originTone(item.source);
                      return (
                        <tr key={item.id}>
                          <td className={TD_TW}>
                            <strong>{displayName(item)}</strong>
                          </td>
                          <td className={TD_TW}>
                            <span
                              className={BADGE_TW}
                              style={{
                                background: tone.badgeBackground,
                                color: tone.badgeColor,
                                borderColor: tone.badgeBorder,
                              }}
                              title={originLabel(item.source)}
                            >
                              {originLabel(item.source)}
                            </span>
                          </td>
                          <td className={TD_TW}>{item.campaign || "—"}</td>
                          <td className={TD_TW}>{item.stage}</td>
                          <td className={TD_TW}>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</td>
                          <td className={TD_TW}>
                            <button
                              className={OPEN_LINK_TW}
                              onClick={() => {
                                window.location.search = "?module=CRM";
                              }}
                              aria-label={"Abrir CRM para " + item.name}
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={EMPTY_TW}>Nenhum contato corresponde à busca.</p>
            )}
          </section>
          <p className={METHOD_TW}>
            {data.basis} {loading ? "Atualizando os dados…" : ""}
          </p>
        </>
      ) : null}
    </section>
  );
}
