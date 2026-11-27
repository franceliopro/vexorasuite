"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, RefreshCcw, Search, ShieldAlert, UsersRound } from "lucide-react";

export type FinanceProviderKey = "ASAAS" | "STRIPE" | "INFINITEPAY";
type ProviderTab = "overview" | "charges" | "customers" | "catalog" | "subscriptions";

type Capability = { source: string; note: string };
type Descriptor = {
  provider: FinanceProviderKey;
  label: string;
  enabled: boolean;
  configured: boolean;
  environment: string | null;
  verification: { status: string; note: string };
  capabilities: {
    customers: Capability;
    catalog: Capability;
    charges: Capability;
    reports: Capability;
    subscriptions: boolean;
    refunds: boolean;
    pixQrCode: boolean;
    whatsappCharge: boolean;
    sandbox: boolean;
  };
  limitations: string[];
  caveat: string;
};
type Dashboard = {
  source: string;
  provider: string;
  environment?: string | string[];
  caveat?: string;
  partial?: boolean;
  totals: { billed: number; paid: number; open: number; count: number; overdueCount?: number };
  series: { month: string; billed: number; paid: number; open: number; overdue?: number }[];
  collectionRate: number | null;
};
type ListRow = Record<string, unknown>;
type ListData = {
  source: string;
  provider: string;
  caveat?: string;
  total?: number;
  hasMore?: boolean;
  items: ListRow[];
};

const pageTw = "grid min-w-0 gap-4 self-start";
const cardTw = "min-w-0 rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-md";
const headTw = "flex flex-wrap items-start justify-between gap-4";
const titleTw = "m-0 text-base font-extrabold text-slate-950";
const subtitleTw = "m-0 text-sm text-slate-600";
const noteTw = "m-0 text-xs leading-relaxed text-slate-600";
const badgeTw = "inline-flex items-center gap-2 rounded-full border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700";
const warnBadgeTw = "inline-flex items-center gap-2 rounded-full border border-amber-600 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-600";
const tabsTw = "flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-200 bg-zinc-100 p-1";
const tabTw = "min-h-8 shrink-0 rounded-full px-3 text-sm font-bold text-slate-600 hover:bg-zinc-200";
const tabActiveTw = "min-h-8 shrink-0 rounded-full bg-blue-600 px-3 text-sm font-bold text-blue-950";
const buttonTw = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 px-4 text-sm font-bold text-slate-700 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60";
const metricsTw = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4";
const metricTw = "grid min-w-0 gap-1 rounded-lg border border-gray-200 bg-white p-3";
const metricLabelTw = "text-xs font-bold uppercase tracking-wider text-slate-600";
const metricValueTw = "truncate text-lg font-extrabold tabular-nums text-slate-950";
const tableWrapTw = "w-full overflow-x-auto";
const errorTw = "flex items-center gap-2 rounded-lg border border-red-600 bg-red-50 p-3 text-sm font-semibold text-red-600";
const sourceTw = "flex items-center gap-2 rounded-lg border border-amber-600 bg-amber-100 p-3 text-sm text-amber-600";
const chartWrapTw = "grid min-w-0 gap-3 rounded-lg border border-gray-200 bg-white p-3";
const chartBarsTw = "flex flex-wrap items-end gap-3";
const chartGroupTw = "grid w-16 justify-items-center gap-1";
const chartTrackTw = "flex h-28 w-10 items-end justify-center gap-1 rounded-md bg-zinc-100";
const chartBilledTw = "w-2 rounded-t bg-blue-600";
const chartPaidTw = "w-2 rounded-t bg-emerald-600";
const chartLabelTw = "w-full truncate text-center text-2xs text-slate-600";

const TABS: { id: ProviderTab; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "charges", label: "Cobranças" },
  { id: "customers", label: "Clientes" },
  { id: "catalog", label: "Catálogo" },
  { id: "subscriptions", label: "Assinaturas" },
];

/** Aceita rótulos da navegação e chaves canônicas da API sem cair no Asaas por acaso. */
const PROVIDER_KEYS: Record<string, FinanceProviderKey> = {
  ASAAS: "ASAAS",
  Asaas: "ASAAS",
  asaas: "ASAAS",
  STRIPE: "STRIPE",
  Stripe: "STRIPE",
  stripe: "STRIPE",
  INFINITEPAY: "INFINITEPAY",
  INFINITE_PAY: "INFINITEPAY",
  "infinite-pay": "INFINITEPAY",
  InfinitePay: "INFINITEPAY",
  infinitepay: "INFINITEPAY",
};
export function normalizeFinanceProvider(value: string | FinanceProviderKey): FinanceProviderKey {
  return PROVIDER_KEYS[String(value).trim()] ?? "ASAAS";
}

const currency = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const first = (row: ListRow, ...keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== "") return row[key];
  }
  return null;
};
const sourceLabel = (source: unknown) => source === "PROVIDER_LIVE" || source === "ASAAS_LIVE"
  ? "Dados consultados no provedor"
  : source === "LOCAL_RECORDS"
    ? "Registros locais da Véxora"
    : "Origem não identificada";

function columnsFor(tab: ProviderTab): { key: string; label: string; render?: (row: ListRow) => string }[] {
  if (tab === "charges") return [
    { key: "id", label: "Identificador" },
    { key: "customer", label: "Cliente", render: (row) => text(first(row, "customerName")) },
    { key: "amount", label: "Valor", render: (row) => currency(first(row, "amount", "value")) },
    { key: "status", label: "Situação" },
    { key: "date", label: "Data", render: (row) => text(first(row, "dueDate", "createdAt")) },
  ];
  if (tab === "customers") return [
    { key: "name", label: "Nome" },
    { key: "email", label: "E-mail" },
    { key: "phone", label: "Telefone" },
    { key: "document", label: "Documento", render: (row) => text(first(row, "documentMasked")) },
  ];
  if (tab === "catalog") return [
    { key: "name", label: "Nome" },
    { key: "description", label: "Descrição" },
    { key: "price", label: "Preço", render: (row) => currency(typeof row.priceCents === "number" ? row.priceCents / 100 : first(row, "value")) },
  ];
  return [
    { key: "id", label: "Identificador" },
    { key: "customer", label: "Cliente", render: (row) => text(first(row, "customerName")) },
    { key: "value", label: "Valor", render: (row) => currency(first(row, "value", "amount")) },
    { key: "cycle", label: "Periodicidade" },
    { key: "status", label: "Situação" },
  ];
}

function capabilityAvailable(tab: ProviderTab, descriptor: Descriptor | null): boolean {
  if (!descriptor) return false;
  if (tab === "subscriptions") return descriptor.capabilities.subscriptions;
  const key = tab === "catalog" ? descriptor.capabilities.catalog : tab === "customers" ? descriptor.capabilities.customers : descriptor.capabilities.charges;
  return key.source !== "UNSUPPORTED";
}

function TrendChart({ series }: { series: Dashboard["series"] }) {
  const max = Math.max(1, ...series.flatMap((row) => [Number(row.billed || 0), Number(row.paid || 0)]));
  return <div className={chartWrapTw}>
    <div className={headTw}>
      <div><h3 className={titleTw}>Faturado x pago por mês</h3><p className={subtitleTw}>Gráfico gerado somente a partir de <code>dashboard.series</code>; sem estimativa.</p></div>
      <p className={noteTw}><span className="text-blue-600">■</span> Faturado <span className="text-emerald-600">■</span> Pago</p>
    </div>
    <div className={chartBarsTw} role="img" aria-label="Barras mensais de valores faturados e pagos">
      {series.length === 0 ? <p className={noteTw}>Sem meses consultados neste período.</p> : series.map((row) => <div className={chartGroupTw} key={row.month} title={`${row.month}: faturado ${currency(row.billed)}, pago ${currency(row.paid)}`}>
        <div className={chartTrackTw}>
          <span className={chartBilledTw} style={{ height: `${Math.max(2, (Number(row.billed || 0) / max) * 100)}%` }} />
          <span className={chartPaidTw} style={{ height: `${Math.max(2, (Number(row.paid || 0) / max) * 100)}%` }} />
        </div>
        <small className={chartLabelTw}>{row.month}</small>
      </div>)}
    </div>
  </div>;
}

export function FinanceProviderWorkspace({ provider: providerRaw }: { provider: FinanceProviderKey | string }) {
  const provider = normalizeFinanceProvider(providerRaw);
  const [tab, setTab] = useState<ProviderTab>("overview");
  const [months, setMonths] = useState(6);
  const [refresh, setRefresh] = useState(0);
  const [descriptor, setDescriptor] = useState<Descriptor | null>(null);
  const [catalogProvider, setCatalogProvider] = useState<string>("ASAAS");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [list, setList] = useState<ListData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setDescriptor(null);
    setTab("overview");
    fetch(`/api/backend/finance/providers/${provider}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.message || "Não foi possível consultar as capacidades do provedor.");
        return body as Descriptor;
      })
      .then((value) => { if (live) setDescriptor(value); })
      .catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Falha ao consultar capacidades."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [provider, refresh]);

  useEffect(() => {
    if (tab !== "overview" && descriptor && !capabilityAvailable(tab, descriptor)) setTab("overview");
  }, [descriptor, tab]);

  // A aba Catálogo só existe na plataforma escolhida no Catálogo do menu.
  useEffect(() => {
    let live = true;
    fetch("/api/backend/finance/catalog-provider", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.message || "Não foi possível consultar a preferência do catálogo.");
        return body as { selected?: string };
      })
      .then((body) => { if (live && body.selected) setCatalogProvider(body.selected); })
      .catch(() => { if (live) setCatalogProvider("ASAAS"); });
    return () => { live = false; };
  }, [refresh]);

  useEffect(() => {
    if (tab === "catalog" && catalogProvider !== provider) setTab("overview");
  }, [catalogProvider, provider, tab]);

  useEffect(() => {
    if (tab !== "overview" && descriptor && !capabilityAvailable(tab, descriptor)) return;
    let live = true;
    setLoading(true);
    setError("");
    const path = tab === "overview"
      ? `/api/backend/finance/${provider}/dashboard?months=${months}`
      : `/api/backend/finance/${provider}/${tab}?offset=0&limit=50`;
    fetch(path, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw Error(body.message || "A consulta ao provedor falhou.");
        return body;
      })
      .then((body) => { if (live) { if (tab === "overview") setDashboard(body as Dashboard); else setList(body as ListData); } })
      .catch((cause) => { if (live) { if (tab === "overview") setDashboard(null); else setList(null); setError(cause instanceof Error ? cause.message : "Falha na consulta."); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [provider, tab, months, refresh, descriptor]);

  const unsupported = tab !== "overview" && descriptor && !capabilityAvailable(tab, descriptor);
  const capabilityNote = descriptor && tab !== "overview" && tab !== "subscriptions"
    ? (tab === "catalog" ? descriptor.capabilities.catalog : tab === "customers" ? descriptor.capabilities.customers : descriptor.capabilities.charges).note
    : "";
  const visibleTabs = TABS.filter((item) =>
    (item.id !== "subscriptions" || descriptor?.capabilities.subscriptions !== false)
    && (item.id !== "catalog" || catalogProvider === provider));
  const normalizedQuery = query.trim().toLowerCase();
  const rows = (list?.items || []).filter((row) => !normalizedQuery
    || Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)));

  return <section className={pageTw} aria-label={`Financeiro ${descriptor?.label || provider}`}>
    <header className={cardTw}>
      <div className={headTw}>
        <div>
          <h1 className={titleTw}>{descriptor?.label || provider}</h1>
          <p className={subtitleTw}>Ecossistema isolado do Asaas. Cada número informa sua origem; nenhum indicador é estimado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={descriptor?.configured ? badgeTw : warnBadgeTw}>{descriptor?.configured ? "Configuração salva" : "Sem credencial salva"}</span>
          <button type="button" className={buttonTw} onClick={() => setRefresh((value) => value + 1)}><RefreshCcw size={15} aria-hidden="true" /> Atualizar</button>
        </div>
      </div>
      {descriptor ? <>
        <p className={noteTw}>Ambiente informado pela configuração: {text(descriptor.environment)}. {descriptor.verification.note}</p>
        {descriptor.environment === "TEST" ? <p role="alert" className={sourceTw}><AlertTriangle size={15} aria-hidden="true" />Ambiente TEST: estes dados nunca devem ser apresentados como produção.</p> : null}
        <p className={noteTw}>{descriptor.caveat}</p>
        <details className={cardTw}>
          <summary className="cursor-pointer text-sm font-bold text-slate-700">Capacidades e limites documentados</summary>
          <div className="mt-3 grid gap-3">
            {[
              { label: "Clientes", value: descriptor.capabilities.customers },
              { label: "Catálogo", value: descriptor.capabilities.catalog },
              { label: "Cobranças", value: descriptor.capabilities.charges },
              { label: "Indicadores", value: descriptor.capabilities.reports },
            ].map((row) => <p className={noteTw} key={row.label}><strong>{row.label}:</strong> {sourceLabel(row.value.source)} — {row.value.note}</p>)}
            <p className={noteTw}><strong>Assinaturas:</strong> {descriptor.capabilities.subscriptions ? "Disponível" : "Não disponível pela API documentada"} · <strong>Estorno:</strong> {descriptor.capabilities.refunds ? "Disponível mediante confirmação explícita" : "Não disponível pela API documentada"}</p>
            <p className={noteTw}><strong>Pix QR Code:</strong> {descriptor.capabilities.pixQrCode ? "Disponível" : "Não gerado nesta integração"} · <strong>Sandbox:</strong> {descriptor.capabilities.sandbox ? "Disponível" : "Indisponível"} · <strong>Cobrança por WhatsApp do provedor:</strong> {descriptor.capabilities.whatsappCharge ? "Disponível" : "Não existe API documentada"}</p>
            <ul className="ml-5 list-disc text-xs text-slate-600">{descriptor.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </details>
      </> : null}
    </header>

    <nav className={tabsTw} aria-label={`Áreas do ${descriptor?.label || provider}`}>
      {visibleTabs.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? tabActiveTw : tabTw} onClick={() => { setTab(item.id); setList(null); setQuery(""); }}>{item.label}</button>)}
    </nav>

    {tab === "overview" ? <section className={cardTw}>
      <div className={headTw}>
        <div><h2 className={titleTw}>Indicadores do período</h2><p className={subtitleTw}>Origem: {dashboard ? sourceLabel(dashboard.source) : "carregando"}</p></div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Período do painel">
          {[1, 3, 6, 12].map((value) => <button key={value} type="button" aria-pressed={months === value} className={months === value ? tabActiveTw : tabTw} onClick={() => setMonths(value)}>{value === 1 ? "Mês atual" : `${value} meses`}</button>)}
        </div>
      </div>
      {loading ? <p role="status">Consultando indicadores do provedor…</p> : error ? <p role="alert" className={errorTw}><AlertTriangle size={16} aria-hidden="true" />{error}</p> : dashboard ? <>
        {dashboard.partial ? <p role="alert" className={sourceTw}><AlertTriangle size={15} aria-hidden="true" />Consulta parcial: nem todos os registros foram incluídos.</p> : null}
        <p className={noteTw}>{dashboard.caveat || "Indicadores calculados sobre os registros consultados; não representam saldo, saques ou conciliação contábil."}</p>
        <div className={metricsTw}>
          <article className={metricTw}><span className={metricLabelTw}>Faturado</span><strong className={metricValueTw}>{currency(dashboard.totals.billed)}</strong></article>
          <article className={metricTw}><span className={metricLabelTw}>Pago</span><strong className={metricValueTw}>{currency(dashboard.totals.paid)}</strong></article>
          <article className={metricTw}><span className={metricLabelTw}>Em aberto</span><strong className={metricValueTw}>{currency(dashboard.totals.open)}</strong></article>
          <article className={metricTw}><span className={metricLabelTw}>Recebimento</span><strong className={metricValueTw}>{dashboard.collectionRate === null ? "—" : `${dashboard.collectionRate}%`}</strong></article>
        </div>
        <TrendChart series={dashboard.series || []} />
        <div className={tableWrapTw}>
          <table>
            <thead><tr><th>Mês</th><th>Faturado</th><th>Pago</th><th>Em aberto</th></tr></thead>
            <tbody>{dashboard.series.map((row) => <tr key={row.month}><td>{row.month}</td><td>{currency(row.billed)}</td><td>{currency(row.paid)}</td><td>{currency(row.open)}</td></tr>)}</tbody>
          </table>
        </div>
      </> : null}
    </section> : unsupported ? <section className={cardTw} role="status">
      <h2 className={titleTw}>Recurso indisponível</h2>
      <p className={noteTw}>{descriptor?.caveat || "A API documentada não expõe esta consulta."}</p>
    </section> : <section className={cardTw}>
      <div className={headTw}>
        <div>
          <h2 className={titleTw}>{tab === "customers" ? "Gestão de clientes" : TABS.find((item) => item.id === tab)?.label}</h2>
          <p className={subtitleTw}>{capabilityNote || "Somente registros consultados na origem declarada."}</p>
        </div>
        <label className="flex min-w-48 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3">
          <Search size={15} aria-hidden="true" />
          <input aria-label="Buscar registros" className="min-h-9 w-full bg-transparent text-sm outline-hidden" placeholder="Buscar nesta aba" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      {loading ? <p role="status">Consultando registros do provedor…</p> : error ? <p role="alert" className={errorTw}><AlertTriangle size={16} aria-hidden="true" />{error}</p> : list ? <>
        <p className={noteTw}>Origem: {sourceLabel(list.source)}{list.total === undefined ? "" : ` · ${list.total} registro(s) no total`}. {list.caveat || ""}</p>
        <div className={tableWrapTw}>
          <table>
            <thead><tr>{columnsFor(tab).map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => <tr key={text(first(row, "id", "externalId", "name")) + index}>{columnsFor(tab).map((column) => <td key={column.key}>{column.render ? column.render(row) : text(row[column.key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className={noteTw}>Nenhum registro encontrado nesta consulta.</p> : null}
      </> : null}
    </section>}

    <p className={noteTw}><ShieldAlert size={14} aria-hidden="true" /> Status de configuração não é confirmação de pagamento. Envios de cobrança continuam na inbox da Véxora; a leitura de dados é tenant-scoped.</p>
    <p className={noteTw}><UsersRound size={14} aria-hidden="true" /> Clientes, cobranças e catálogo ficam neste ecossistema. O catálogo é o mesmo da empresa, escolhido no Catálogo.</p>
    <p className={noteTw}><BarChart3 size={14} aria-hidden="true" /> <CheckCircle2 size={14} aria-hidden="true" /> <Clock3 size={14} aria-hidden="true" /> Valores em BRL. Nenhuma operação externa é executada por esta tela.</p>
  </section>;
}
