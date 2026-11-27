"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Search, Trash2, X, ExternalLink, Building2, CircleDollarSign, ShieldCheck, Boxes } from "lucide-react";
import { createPortal } from "react-dom";

type Plan = { id: string; code: string; kind: string; name: string; tagline: string; description: string; audience: string; priceCents: number; currency: string; cycle: string; limits: any; isActive: boolean; isPublic: boolean; sortOrder: number };
type Customer = { id: string; name: string; slug: string; status: string; createdAt: string; plan: Plan | null; seats: number; channels: number; conversations: number; entitlements: any; paymentProvider?: "ASAAS" | "STRIPE" | "INFINITEPAY"; aiMonth?: number; monthlyPriceCents: number };
const PRICE = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const dangerTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-red-600 bg-red-100 px-4 text-body font-bold text-red-600 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonTw = "inline-grid size-9 place-items-center rounded-token-sm border border-line bg-surface text-ink shadow-token-sm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
/* TW utility-first: cores, raios e medidas do preset; estados em mapas literais. */
const rootTw = "grid min-w-0 gap-4";
const heroTw = "flex items-center justify-between gap-4.5 rounded-token-lg border border-line bg-linear-to-br from-blue-50 to-surface px-6 py-5.5 max-md:flex-col max-md:items-start";
const eyebrowTw = "inline-flex items-center gap-1.5 font-display text-2xs font-extrabold uppercase tracking-flow-wide text-blue-800";
const heroTitleTw = "mb-1 mt-1.5 font-display text-3xl font-extrabold text-ink";
const heroCopyTw = "m-0 max-w-crm-copy text-docs-hint text-ink-secondary";
const kpisTw = "flex flex-none gap-4.5 max-md:flex-wrap";
const kpiTw = "grid gap-0.5 rounded-catalog-icon border border-line bg-surface px-3.5 py-2.5";
const kpiLabelTw = "font-display text-2xs font-bold uppercase tracking-fin-label text-ink-secondary";
const kpiValueTw = "font-display text-fin-metric font-extrabold tabular-nums text-ink";
const errorTw = "m-0 rounded-catalog-icon border border-danger bg-red-50 px-3 py-2.25 text-docs-hint text-red-600";
const tabsTw = "flex w-max gap-1 rounded-catalog-icon border border-line bg-surface-2 p-1.25";
const tabTw = "inline-flex min-h-ctl-sm items-center gap-1.75 rounded-catalog-icon px-3.5 font-display text-breadcrumb font-bold transition-colors";
const tabStateTw: Record<string, string> = { active: "bg-surface text-ink shadow-token-sm", idle: "text-ink-secondary hover:bg-surface hover:text-ink" };
const loadingTw = "flex items-center justify-center gap-2.5 p-7 text-ink-secondary";
const actionsTw = "flex items-center justify-between gap-3";
const hintTw = "m-0 text-2xs text-ink-secondary";
const plansTw = "grid grid-cols-catalog-grid gap-3.5";
const planTw = "grid content-start gap-2.5 rounded-token-lg border border-line bg-surface p-4";
const planStateTw: Record<string, string> = { active: "", archived: "opacity-55" };
const planHeadTw = "flex items-center gap-1.75";
const planCodeTw = "rounded-square bg-surface-2 px-2.25 py-1 font-display text-2xs font-extrabold uppercase tracking-fin-label text-ink-secondary";
const pillTw = "rounded-full px-2.25 py-1 font-display text-2xs font-extrabold uppercase tracking-fin-label";
const pillStateTw: Record<string, string> = {
  plan: "border border-blue-600 bg-blue-50 text-blue-600",
  package: "border border-sky-600 bg-sky-100 text-sky-600",
  live: "border border-blue-600 bg-blue-50 text-blue-700",
  off: "border border-line-strong bg-surface-2 text-ink-secondary",
};
const priceTw = "flex items-baseline gap-1.5";
const priceValueTw = "font-display text-3xl font-extrabold tabular-nums text-ink";
const priceCycleTw = "text-breadcrumb text-ink-secondary";
const planTitleTw = "m-0 font-display text-asaas-title font-extrabold text-ink";
const taglineTw = "m-0 min-h-8 text-docs-meta text-ink-secondary";
const limitsTw = "m-0 grid list-none gap-1.25 border-y border-line px-0 py-2.5";
const limitRowTw = "flex items-baseline justify-between gap-2.5 text-2xs text-ink-secondary";
const limitValueTw = "font-extrabold tabular-nums text-ink";
const modulesTw = "m-0 text-fm-meta text-ink-secondary";
const planFooterTw = "mt-auto flex justify-between gap-2";
const customersTw = "grid gap-3";
const searchTw = "flex max-w-catalog-search items-center gap-2.25 rounded-token-sm border border-line bg-surface-2 px-3.25 text-ink-secondary";
const searchInputTw = "min-h-ctl min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none";
const tableWrapTw = "overflow-x-auto rounded-catalog-icon border border-line bg-surface";
const tableTw = "w-full border-collapse text-breadcrumb";
const thTw = "bg-surface-2 px-3.25 py-2.75 text-left font-display text-2xs font-extrabold uppercase tracking-fin-label text-ink-secondary";
const tdTw = "border-b border-line px-3.25 py-2.75 align-middle";
const customerTw = "flex items-center gap-2.5";
const customerMarkTw = "grid size-8.5 flex-none place-items-center rounded-catalog-icon bg-linear-to-br from-blue-600 to-sky-600 font-display text-h4 font-extrabold text-white";
const customerNameTw = "block text-ink";
const customerSlugTw = "text-fm-meta text-ink-secondary";
const planSelectTw = "min-h-ctl-sm max-w-55 rounded-token-sm border border-line bg-surface-2 text-docs-meta text-ink";
const dialogBackdropTw = "fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm";
const dialogSectionTw = "relative z-10 flex max-h-dvh w-full max-w-lg flex-col overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50";
const dialogHeadingTw = "mb-3.5 flex min-w-0 flex-none items-center gap-3 pr-10";
const dialogIconTw = "grid size-10 flex-none place-items-center rounded-xl border border-blue-600/20 bg-blue-50 text-blue-800";
const dialogCloseTw = "absolute right-3 top-3 z-10 grid size-ctl-sm place-items-center rounded-xl border border-line bg-surface-2 text-ink-secondary transition-colors hover:bg-hover hover:text-ink";
const dialogFooterTw = "mt-0 flex flex-none justify-end gap-2 border-t border-line pt-3";
const editorSectionTw = "relative z-10 grid max-h-dvh w-full max-w-4xl grid-rows-docs-editor overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50";
const editorBodyTw = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4";
const editorGridTw = "grid grid-cols-2 gap-2.5 max-lg:grid-cols-1";
const fieldTw = "grid gap-1.25";
const fieldLabelTw = "font-display text-asaas-label font-bold text-ink-secondary";
const fieldControlTw = "min-h-ctl-sm rounded-token-sm border border-line bg-surface-2 px-2.5 text-body text-ink";
const fieldTextareaTw = "min-h-16 resize-y py-2";
const fieldWideTw = "col-span-full";
const limitsFieldsetTw = "mt-5 grid gap-2 rounded-catalog-icon border border-line px-3 py-2.5";
const limitsLegendTw = "px-1.5 font-display text-2xs font-extrabold uppercase tracking-fin-label text-ink-secondary";
const limitsGridTw = "grid grid-cols-4 gap-2 max-lg:grid-cols-3 max-md:grid-cols-2";
const checkTw = "flex items-center gap-1.75 text-docs-meta text-ink";
const flagsTw = "mt-2 flex gap-3.5";
const modulesBlockTw = "mt-1 grid gap-3";
const modulesHeadTw = "flex flex-wrap items-end justify-between gap-3.5";
const presetsTw = "flex flex-wrap gap-1.5";
const presetButtonTw = "inline-flex min-h-7.5 items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-3 text-asaas-label font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const modulesGridTw = "grid grid-cols-fm-picker gap-2";
const moduleCheckTw = "flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 transition-colors hover:border-blue-600";
const moduleCheckStateTw: Record<string, string> = { checked: "border-blue-600 bg-blue-50", unchecked: "" };
const moduleCheckboxTw = "size-4 cursor-pointer accent-blue-600";
const moduleLabelTw = "grid gap-0.5 font-display text-small font-extrabold text-ink";
const moduleCodeTw = "text-2xs font-semibold tracking-fin-label text-ink-secondary";
const MODULE_LABELS: Record<string, string> = { INBOX: "Atendimento", CRM: "CRM", CALENDAR: "Calendários", TASKS: "Tarefas", AUTOMATION: "Automação / Chatbot", MARKETING: "Marketing", SITES: "Sites, landing pages e formulários", FINANCE: "Financeiro", CHANNELS: "Canais e redes", SCHOOL: "Gestão escolar", SETTINGS: "Configurações"};
const PAYMENT_PLATFORM_CHOICES = [
  { id: "ASAAS", label: "Asaas (Recomendado — mais completo)" },
  { id: "STRIPE", label: "Stripe" },
  { id: "INFINITEPAY", label: "InfinitePay" },
] as const;
const LIMIT_FIELDS: Array<{ key: string; label: string; kind: "number" | "bool" | "text" | "modules"; placeholder?: string; hint?: string }> = [
  { key: "attendants", label: "Atendentes (usuários)", kind: "number", placeholder: "5" },
  { key: "bots", label: "Robôs com IA", kind: "number", placeholder: "1" },
  { key: "ia", label: "Crédito/uso de IA por mês", kind: "number", placeholder: "300" },
  { key: "iaTier", label: "Tier da IA", kind: "text", placeholder: "eco | standard | basic" },
  { key: "sites", label: "Sites incluídos", kind: "number", placeholder: "1" },
  { key: "dynamic", label: "Site dinâmico (posts/imóveis)", kind: "bool" },
  { key: "forms", label: "Formulários de captura", kind: "bool" },
  { key: "socialAccounts", label: "Redes sociais vinculadas", kind: "number", placeholder: "4" },
  { key: "whatsapp", label: "WhatsApps vinculados", kind: "bool" },
  { key: "crm", label: "CRM completo", kind: "bool" },
  { key: "finance", label: "Financeiro Asaas", kind: "bool" },
  { key: "followups", label: "Follow-ups / cobrança", kind: "bool" },
  { key: "marketingPublishing", label: "Publicação de conteúdo", kind: "bool" },
];
const EMPTY_PLAN: Omit<Plan, "id"> = { code: "", kind: "PLAN", name: "", tagline: "", description: "", audience: "", priceCents: 0, currency: "BRL", cycle: "MONTH", limits: { attendants: 1, bots: 1, ia: 100, iaTier: "eco", sites: 0, dynamic: false, forms: false, socialAccounts: 2, whatsapp: true, crm: false, finance: false, followups: false, marketingPublishing: false, modules: ["SITES"] }, isActive: true, isPublic: true, sortOrder: 0 };
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch("/api/backend" + path, { cache: "no-store", headers: { "content-type": "application/json" }, ...init });
  const data = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.message || "Não foi possível concluir a ação.");
  return data as T;
}
const strArr = (v: unknown) => Array.isArray(v) ? v.filter(x => typeof x === "string") : [];
const MODULE_ORDER = ["INBOX", "CRM", "CALENDAR", "TASKS", "AUTOMATION", "MARKETING", "SITES", "FINANCE", "CHANNELS", "SCHOOL", "SETTINGS"] as const;
const PLAN_PRESETS: { label: string; modules: string[] }[] = [
  { label: "Só Sites", modules: ["SITES"] },
  { label: "Sites + Social", modules: ["SITES", "MARKETING"] },
  { label: "Sites + Social + Atendimento", modules: ["SITES", "MARKETING", "INBOX", "CHANNELS", "CRM"] },
  { label: "Operação completa", modules: ["INBOX", "CRM", "CALENDAR", "TASKS", "AUTOMATION", "MARKETING", "FINANCE", "CHANNELS"] },
  { label: "Gestão escolar", modules: ["SCHOOL"] },
];

export function PlatformAdminWorkspace({ initialTab }: { initialTab?: "plans" | "customers" }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mrr, setMrr] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"plans" | "customers">(initialTab || "plans");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [draft, setDraft] = useState(EMPTY_PLAN as Omit<Plan, "id">);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([api<{ plans: Plan[] }>("/plans"), api<{ customers: Customer[]; mrrCents: number; total: number }>("/plans/customers")]);
      setPlans(p.plans || []); setCustomers(c.customers || []); setMrr(c.mrrCents || 0); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const openNew = () => { setDraft({ ...EMPTY_PLAN, limits: { ...EMPTY_PLAN.limits } }); setEditing(null); setEditorOpen(true); };
  const openEdit = (p: Plan) => { setEditing(p); setDraft({ code: p.code, kind: p.kind, name: p.name, tagline: p.tagline, description: p.description, audience: p.audience, priceCents: p.priceCents, currency: p.currency, cycle: p.cycle, limits: { ...p.limits }, isActive: p.isActive, isPublic: p.isPublic, sortOrder: p.sortOrder }); setEditorOpen(true); };
  const save = async () => {
    setSaving(true); setError("");
    try {
      const body = { ...draft, priceCents: Math.round((Number(draft.priceCents) || 0)), sortOrder: Number(draft.sortOrder) || 0 };
      if (editing) await api(`/plans/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/plans", { method: "POST", body: JSON.stringify(body) });
      setEditorOpen(false);
      setEditing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };
  const archive = async (id: string) => { try { await api(`/plans/${id}`, { method: "DELETE" }); setConfirmArchive(null); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível arquivar."); } };
  const assignPlan = async (customerId: string, planId: string | null) => {
    try { await api(`/plans/customers/${customerId}/plan`, { method: "PATCH", body: JSON.stringify({ planId }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atribuir o plano."); }
  };
  const setPlansAccess = async (customerId: string, enabled: boolean) => {
    try { await api(`/plans/customers/${customerId}/plans-access`, { method: "PATCH", body: JSON.stringify({ enabled }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível alterar o acesso a Planos e preços."); }
  };
  const setPaymentProvider = async (customerId: string, paymentProvider: string) => {
    try { await api(`/plans/customers/${customerId}/payment-provider`, { method: "PATCH", body: JSON.stringify({ paymentProvider }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível alterar a plataforma de pagamento."); }
  };
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter(c => !term || [c.name, c.slug, c.plan?.name, c.plan?.code].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [customers, q]);
  const activeCustomers = customers.filter(c => c.status === "ACTIVE").length;
  return (
    <section className={rootTw}>
      <header className={heroTw}>
        <div><span className={eyebrowTw}><ShieldCheck size={13} aria-hidden="true" /> Administração Véxora</span><h1 className={heroTitleTw}>Planos, pacotes e clientes</h1><p className={heroCopyTw}>Catálogo completo de preços e limites. Clientes trocam de plano em segundos; entitlements são aplicados na hora.</p></div>
        <div className={kpisTw}><div className={kpiTw}><small className={kpiLabelTw}>MRR</small><b className={kpiValueTw}>{PRICE(mrr)}</b></div><div className={kpiTw}><small className={kpiLabelTw}>Clientes ativos</small><b className={kpiValueTw}>{activeCustomers}</b></div><div className={kpiTw}><small className={kpiLabelTw}>Planos ativos</small><b className={kpiValueTw}>{plans.filter(p => p.isActive).length}</b></div></div>
      </header>
      {error && <p className={errorTw} role="alert">{error}</p>}
      <div className={tabsTw} role="tablist"><button type="button" role="tab" aria-selected={tab === "plans"} className={tabTw+" "+tabStateTw[tab === "plans" ? "active" : "idle"]} onClick={() => setTab("plans")}><Boxes size={15} aria-hidden="true" /> Planos e pacotes</button><button type="button" role="tab" aria-selected={tab === "customers"} className={tabTw+" "+tabStateTw[tab === "customers" ? "active" : "idle"]} onClick={() => setTab("customers")}><Building2 size={15} aria-hidden="true" /> Clientes ({customers.length})</button></div>

      {loading ? <div className={loadingTw}><Loader2 size={20} className="animate-spin" aria-hidden="true" /> Carregando…</div> : tab === "plans" ? (
        <>
          <div className={actionsTw}><button type="button" className={primaryTw} onClick={openNew}><Plus size={15} aria-hidden="true" /> Novo plano</button><p className={hintTw}>Arquivar (em vez de excluir) preserva empresas que já usam o plano.</p></div>
          <div className={plansTw}>
            {plans.map(p => (
              <article key={p.id} className={planTw+" "+planStateTw[p.isActive ? "active" : "archived"]}>
                <header className={planHeadTw}><span className={planCodeTw}>{p.code}</span><span className={pillTw+" "+pillStateTw[p.kind === "PACKAGE" ? "package" : "plan"]}>{p.kind === "PACKAGE" ? "Pacote" : "Plano"}</span><span className={pillTw+" "+pillStateTw[p.isActive ? "live" : "off"]}>{p.isActive ? "Ativo" : "Arquivado"}</span>{!p.isPublic && <span className={pillTw+" "+pillStateTw.off}>Oculto</span>}</header>
                <div className={priceTw}><b className={priceValueTw}>{PRICE(p.priceCents)}</b><small className={priceCycleTw}>/{p.cycle === "MONTH" ? "mês" : p.cycle === "YEAR" ? "ano" : "único"}</small></div>
                <h2 className={planTitleTw}>{p.name}</h2><p className={taglineTw}>{p.tagline || p.audience || "—"}</p>
                <ul className={limitsTw}>{LIMIT_FIELDS.filter(f => f.kind !== "modules").map(f => <li key={f.key} className={limitRowTw}><span>{f.label}</span><b className={limitValueTw}>{renderLimit(p, f.key)}</b></li>)}</ul>
                <p className={modulesTw}>{strArr(p.limits?.modules).map(m => MODULE_LABELS[m] || m).join(" · ") || "Sem módulos listados"}</p>
                <footer className={planFooterTw}><button type="button" className={secondaryTw} onClick={() => openEdit(p)}>Editar</button>{p.isActive && <button type="button" className={iconButtonTw} title="Arquivar" aria-label="Arquivar plano" onClick={() => setConfirmArchive(p.id)}><Trash2 size={15} aria-hidden="true" /></button>}</footer>
              </article>
            ))}
          </div>
          {editorOpen && <Editor draft={draft} setDraft={setDraft} editing={editing} onClose={() => setEditorOpen(false)} onSave={save} saving={saving} />}
        </>
      ) : (
        <div className={customersTw}>
          <p className="m-0 text-docs-hint text-ink-secondary">Planos e preços fica fora do menu dos clientes por padrão. Marque a opção abaixo para liberar em uma, duas ou várias empresas ao mesmo tempo.</p>
          <p className="m-0 text-docs-hint text-ink-secondary">Cada empresa usa exatamente uma plataforma de pagamento. A escolha oculta as demais do menu da empresa; Asaas é recomendado por ser mais completo. As formas de pagamento disponíveis ao cliente não são alteradas aqui.</p>
          <label className={searchTw} style={{ display: "flex" }}><Search size={15} aria-hidden="true" /><input className={searchInputTw} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar empresa…" aria-label="Buscar empresa" /></label>
          <div className={tableWrapTw}><table className={tableTw} style={{ minWidth: 980 }}><thead><tr><th className={thTw}>Empresa</th><th className={thTw}>Plano</th><th className={thTw}>Plataforma de pagamento</th><th className={thTw}>Planos e preços</th><th className={thTw}>Status</th><th className={thTw}>Assentos</th><th className={thTw}>Canais</th><th className={thTw}>Conversas</th><th className={thTw}>IA/mês</th><th className={thTw}>MRR</th><th className={thTw}></th></tr></thead><tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td className={tdTw}><div className={customerTw}><span className={customerMarkTw} aria-hidden="true">{c.name.trim().slice(0, 1).toUpperCase()}</span><span><b className={customerNameTw}>{c.name}</b><small className={customerSlugTw}>{c.slug}</small></span></div></td>
                <td className={tdTw}><select className={planSelectTw} value={c.plan?.id || ""} onChange={e => void assignPlan(c.id, e.target.value || null)} aria-label={"Plano de " + c.name}><option value="">Sem plano</option>{plans.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td className={tdTw}><select className={planSelectTw} data-testid="payment-platform-select" value={c.paymentProvider || "ASAAS"} onChange={e => void setPaymentProvider(c.id, e.target.value)} aria-label={"Plataforma de pagamento de " + c.name}>{PAYMENT_PLATFORM_CHOICES.map(choice => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select></td>
                <td className={tdTw}><label className={checkTw} data-testid="plans-access-toggle"><input type="checkbox" className={moduleCheckboxTw} checked={strArr(c.entitlements?.modules).includes("PLANS")} onChange={e => void setPlansAccess(c.id, e.target.checked)} aria-label={"Planos e preços para " + c.name} /> <span>Liberado</span></label></td>
                <td className={tdTw}><span className={pillTw+" "+pillStateTw[c.status === "ACTIVE" ? "live" : "off"]}>{c.status === "ACTIVE" ? "Ativa" : c.status}</span></td>
                <td className={tdTw}>{c.seats}</td><td className={tdTw}>{c.channels}</td><td className={tdTw}>{c.conversations}</td><td className={tdTw} title={"Execuções de IA neste mês: " + (c.aiMonth ?? 0)}>{c.aiMonth ?? 0}</td><td className={tdTw}>{PRICE(c.monthlyPriceCents)}</td><td className={tdTw}><a href={"/?module=Configurações"} className={iconButtonTw} title="Abrir empresa" aria-label="Abrir empresa"><ExternalLink size={14} aria-hidden="true" /></a></td>
              </tr>
            ))}
          </tbody></table></div>
        </div>
      )}
      {confirmArchive && <div className={dialogBackdropTw} role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmArchive(null); }}>
        <section className={dialogSectionTw} role="dialog" aria-modal="true" aria-label="Arquivar plano">
          <header className={dialogHeadingTw}><div className="min-w-0"><h2 className="truncate">Arquivar plano</h2><p>Empresas vinculadas continuam no plano arquivado; novos não poderão ser contratados.</p></div><button type="button" className={dialogCloseTw} aria-label="Fechar" onClick={() => setConfirmArchive(null)}><X size={16} aria-hidden="true" /></button></header>
          <footer className={dialogFooterTw}><button type="button" className={secondaryTw} onClick={() => setConfirmArchive(null)}>Voltar</button><button type="button" className={dangerTw} onClick={() => { void archive(confirmArchive); }}>Arquivar</button></footer>
        </section>
      </div>}
    </section>
  );
}
function renderLimit(p: Plan, key: string): string {
  const v = p.limits?.[key];
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return v == null || v === "" ? "—" : String(v);
}
function Editor({ draft, setDraft, editing, onClose, onSave, saving }: { draft: Omit<Plan, "id">; setDraft: (d: Omit<Plan, "id">) => void; editing: Plan | null; onClose: () => void; onSave: () => Promise<void>; saving: boolean }) {
  const upd = (patch: Partial<Omit<Plan, "id">>) => setDraft({ ...draft, ...patch });
  const setLimit = (key: string, value: any) => setDraft({ ...draft, limits: { ...draft.limits, [key]: value } });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={dialogBackdropTw} role="presentation" style={{ zIndex: 2100 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={editorSectionTw} role="dialog" aria-modal="true" aria-label={editing ? "Editar plano" : "Novo plano"} style={{ width: "min(880px, calc(100vw - 28px))", maxHeight: "88dvh", display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto" }}>
        <header className={dialogHeadingTw}><span className={dialogIconTw}><CircleDollarSign size={18} aria-hidden="true" /></span><div className="min-w-0"><h2 className="truncate">{editing ? "Editar plano" : "Novo plano / pacote"}</h2><p>{editing ? "Alterações passam a valer na próxima atribuição." : "Defina nome, preço, ciclo e limites."}</p></div><button type="button" className={dialogCloseTw} aria-label="Fechar" onClick={onClose}><X size={17} aria-hidden="true" /></button></header>
        <div className={editorBodyTw}>
          <div className={editorGridTw}>
            <label className={fieldTw}><span className={fieldLabelTw}>Nome</span><input className={fieldControlTw} autoFocus value={draft.name} onChange={e => upd({ name: e.target.value })} placeholder="Só Sites" /></label>
            <label className={fieldTw}><span className={fieldLabelTw}>Código</span><input className={fieldControlTw} value={draft.code} onChange={e => upd({ code: e.target.value.toLowerCase() })} placeholder="base-plano" /></label>
            <label className={fieldTw}><span className={fieldLabelTw}>Tipo</span><select className={fieldControlTw} value={draft.kind} onChange={e => upd({ kind: e.target.value })}><option value="PLAN">Plano</option><option value="PACKAGE">Pacote</option></select></label>
            <label className={fieldTw}><span className={fieldLabelTw}>Ciclo</span><select className={fieldControlTw} value={draft.cycle} onChange={e => upd({ cycle: e.target.value })}><option value="MONTH">Mensal</option><option value="YEAR">Anual</option><option value="ONCE">Único</option></select></label>
            <label className={fieldTw}><span className={fieldLabelTw}>Preço (R$)</span><input className={fieldControlTw} type="number" min={0} step="0.01" value={(draft.priceCents / 100).toFixed(2)} onChange={e => upd({ priceCents: Math.round((parseFloat(e.target.value) || 0) * 100) })} /></label>
            <label className={fieldTw}><span className={fieldLabelTw}>Ordem</span><input className={fieldControlTw} type="number" value={draft.sortOrder} onChange={e => upd({ sortOrder: Number(e.target.value) || 0 })} /></label>
            <label className={fieldTw+" "+fieldWideTw}><span className={fieldLabelTw}>Tagline</span><input className={fieldControlTw} value={draft.tagline} onChange={e => upd({ tagline: e.target.value })} placeholder="Site profissional em 24h" /></label>
            <label className={fieldTw+" "+fieldWideTw}><span className={fieldLabelTw}>Descrição</span><textarea className={fieldControlTw+" "+fieldTextareaTw} rows={2} value={draft.description} onChange={e => upd({ description: e.target.value })} placeholder="O que está incluído, benefícios, garantias…" /></label>
            <label className={fieldTw+" "+fieldWideTw}><span className={fieldLabelTw}>Público-alvo</span><input className={fieldControlTw} value={draft.audience} onChange={e => upd({ audience: e.target.value })} placeholder="Restaurantes, clínicas…" /></label>
          </div>
          <fieldset className={limitsFieldsetTw}><legend className={limitsLegendTw}>Limites e recursos</legend><div className={limitsGridTw}>{LIMIT_FIELDS.map(f => f.kind === "bool" ? (<label key={f.key} className={checkTw}><input type="checkbox" checked={!!draft.limits?.[f.key]} onChange={e => upd({ limits: { ...draft.limits, [f.key]: e.target.checked } })} /> <span>{f.label}</span></label>) : (<label key={f.key} className={fieldTw}><span className={fieldLabelTw}>{f.label}</span><input className={fieldControlTw} type={f.kind === "number" ? "number" : "text"} min={0} value={draft.limits?.[f.key] ?? ""} onChange={e => setLimit(f.key, f.kind === "number" ? Number(e.target.value) || 0 : e.target.value)} placeholder={f.placeholder} /></label>))}</div>
            <div className={modulesBlockTw}>
              <div className={modulesHeadTw}><span className="grid gap-0.5"><strong className="font-display text-body font-extrabold text-ink">Módulos liberados</strong><small className="text-docs-meta text-ink-secondary">Landing Pages e Formulários entram no pacote <em>Sites</em>. Publicação social fica só com <em>Marketing</em>.</small></span><div className={presetsTw}>{PLAN_PRESETS.map(preset => <button key={preset.label} type="button" className={presetButtonTw} onClick={() => upd({ limits: { ...draft.limits, modules: [...preset.modules, "SETTINGS"] } })} title={"Preencher com " + preset.label}>{preset.label}</button>)}</div></div>
              <div className={modulesGridTw} role="group" aria-label="Módulos liberados">
                {MODULE_ORDER.filter(m => m !== "SETTINGS").map(m => {
                  const checked = strArr(draft.limits?.modules).includes(m);
                  return (
                    <label key={m} className={moduleCheckTw+" "+moduleCheckStateTw[checked ? "checked" : "unchecked"]}>
                      <input type="checkbox" className={moduleCheckboxTw} checked={checked} onChange={e => { const current = strArr(draft.limits?.modules).filter(x => x !== "SETTINGS"); const next = e.target.checked ? [...current, m] : current.filter(x => x !== m); upd({ limits: { ...draft.limits, modules: [...next, "SETTINGS"] } }); }} />
                      <span className={moduleLabelTw}>{MODULE_LABELS[m] || m}<small className={moduleCodeTw}>{m}</small></span>
                    </label>
                  );
                })}
              </div>
            </div>
          </fieldset>
          <div className={flagsTw}><label className={checkTw}><input type="checkbox" checked={draft.isActive} onChange={e => upd({ isActive: e.target.checked })} /> <span>Plano ativo</span></label><label className={checkTw}><input type="checkbox" checked={draft.isPublic} onChange={e => upd({ isPublic: e.target.checked })} /> <span>Visível no catálogo público</span></label></div>
        </div>
        <footer className={dialogFooterTw}><button type="button" className={secondaryTw} onClick={onClose}>Cancelar</button><button type="button" className={primaryTw} disabled={saving || !draft.name.trim() || !draft.code.trim()} onClick={() => void onSave()}>{saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />} Salvar</button></footer>
      </section>
    </div>,
    document.body,
  );
}
