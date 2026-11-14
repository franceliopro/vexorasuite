"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Search, Trash2, X, ExternalLink, Building2, CircleDollarSign, ShieldCheck, Boxes } from "lucide-react";
import { createPortal } from "react-dom";

type Plan = { id: string; code: string; kind: string; name: string; tagline: string; description: string; audience: string; priceCents: number; currency: string; cycle: string; limits: any; isActive: boolean; isPublic: boolean; sortOrder: number };
type Customer = { id: string; name: string; slug: string; status: string; createdAt: string; plan: Plan | null; seats: number; channels: number; conversations: number; entitlements: any; aiMonth?: number; monthlyPriceCents: number };
const PRICE = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MODULE_LABELS: Record<string, string> = { INBOX: "Atendimento", CRM: "CRM", CALENDAR: "Calendários", TASKS: "Tarefas", AUTOMATION: "Automação / Chatbot", MARKETING: "Marketing", FINANCE: "Financeiro", CHANNELS: "Canais e redes", SETTINGS: "Configurações", SITES: "Sites" };
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
const MODULE_ORDER = ["SITES", "INBOX", "CRM", "CALENDAR", "TASKS", "AUTOMATION", "MARKETING", "FINANCE", "CHANNELS", "SETTINGS"] as const;
const PLAN_PRESETS: { label: string; modules: string[] }[] = [
  { label: "Só Sites", modules: ["SITES"] },
  { label: "Sites + Social", modules: ["SITES", "MARKETING"] },
  { label: "Sites + Social + Atendimento", modules: ["SITES", "MARKETING", "INBOX", "CHANNELS", "CRM"] },
  { label: "Operação completa", modules: ["SITES", "INBOX", "CRM", "CALENDAR", "TASKS", "AUTOMATION", "MARKETING", "FINANCE", "CHANNELS"] },
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
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter(c => !term || [c.name, c.slug, c.plan?.name, c.plan?.code].filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [customers, q]);
  const activeCustomers = customers.filter(c => c.status === "ACTIVE").length;
  return (
    <section className="platform-admin">
      <header className="platform-admin-hero">
        <div><span className="platform-admin-eyebrow"><ShieldCheck size={13} aria-hidden="true" /> Administração Véxora</span><h1>Planos, pacotes e clientes</h1><p>Catálogo completo de preços e limites. Clientes trocam de plano em segundos; entitlements são aplicados na hora.</p></div>
        <div className="platform-admin-kpis"><div><small>MRR</small><b>{PRICE(mrr)}</b></div><div><small>Clientes ativos</small><b>{activeCustomers}</b></div><div><small>Planos ativos</small><b>{plans.filter(p => p.isActive).length}</b></div></div>
      </header>
      {error && <p className="platform-admin-error" role="alert">{error}</p>}
      <div className="platform-admin-tabs" role="tablist"><button type="button" role="tab" aria-selected={tab === "plans"} className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}><Boxes size={15} aria-hidden="true" /> Planos e pacotes</button><button type="button" role="tab" aria-selected={tab === "customers"} className={tab === "customers" ? "active" : ""} onClick={() => setTab("customers")}><Building2 size={15} aria-hidden="true" /> Clientes ({customers.length})</button></div>

      {loading ? <div className="platform-admin-loading"><Loader2 size={20} className="vx-spin" aria-hidden="true" /> Carregando…</div> : tab === "plans" ? (
        <>
          <div className="platform-admin-actions"><button type="button" className="primary-button" onClick={openNew}><Plus size={15} aria-hidden="true" /> Novo plano</button><p className="platform-admin-hint">Arquivar (em vez de excluir) preserva empresas que já usam o plano.</p></div>
          <div className="platform-admin-plans">
            {plans.map(p => (
              <article key={p.id} className={"platform-admin-plan " + (p.isActive ? "" : "is-archived")}>
                <header><span className="platform-admin-plan-code">{p.code}</span><span className={"platform-admin-pill " + (p.kind === "PACKAGE" ? "is-package" : "is-plan")}>{p.kind === "PACKAGE" ? "Pacote" : "Plano"}</span><span className={"platform-admin-pill " + (p.isActive ? "is-live" : "is-off")}>{p.isActive ? "Ativo" : "Arquivado"}</span>{!p.isPublic && <span className="platform-admin-pill is-off">Oculto</span>}</header>
                <div className="platform-admin-plan-price"><b>{PRICE(p.priceCents)}</b><small>/{p.cycle === "MONTH" ? "mês" : p.cycle === "YEAR" ? "ano" : "único"}</small></div>
                <h2>{p.name}</h2><p className="platform-admin-tagline">{p.tagline || p.audience || "—"}</p>
                <ul className="platform-admin-limits">{LIMIT_FIELDS.filter(f => f.kind !== "modules").map(f => <li key={f.key}><span>{f.label}</span><b>{renderLimit(p, f.key)}</b></li>)}</ul>
                <p className="platform-admin-modules">{strArr(p.limits?.modules).map(m => MODULE_LABELS[m] || m).join(" · ") || "Sem módulos listados"}</p>
                <footer><button type="button" className="secondary-button" onClick={() => openEdit(p)}>Editar</button>{p.isActive && <button type="button" className="icon-button" title="Arquivar" aria-label="Arquivar plano" onClick={() => setConfirmArchive(p.id)}><Trash2 size={15} aria-hidden="true" /></button>}</footer>
              </article>
            ))}
          </div>
          {editorOpen && <Editor draft={draft} setDraft={setDraft} editing={editing} onClose={() => setEditorOpen(false)} onSave={save} saving={saving} />}
        </>
      ) : (
        <div className="platform-admin-customers">
          <label className="platform-admin-search"><Search size={15} aria-hidden="true" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar empresa…" aria-label="Buscar empresa" /></label>
          <div className="platform-admin-table-wrap"><table className="platform-admin-table"><thead><tr><th>Empresa</th><th>Plano</th><th>Status</th><th>Assentos</th><th>Canais</th><th>Conversas</th><th>IA/mês</th><th>MRR</th><th></th></tr></thead><tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td><div className="platform-admin-customer"><span className="platform-admin-customer-mark" aria-hidden="true">{c.name.trim().slice(0, 1).toUpperCase()}</span><span><b>{c.name}</b><small>{c.slug}</small></span></div></td>
                <td><select value={c.plan?.id || ""} onChange={e => void assignPlan(c.id, e.target.value || null)} aria-label={"Plano de " + c.name}><option value="">Sem plano</option>{plans.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                <td><span className={"platform-admin-pill " + (c.status === "ACTIVE" ? "is-live" : "is-off")}>{c.status === "ACTIVE" ? "Ativa" : c.status}</span></td>
                <td>{c.seats}</td><td>{c.channels}</td><td>{c.conversations}</td><td title={"Execuções de IA neste mês: " + (c.aiMonth ?? 0)}>{c.aiMonth ?? 0}</td><td>{PRICE(c.monthlyPriceCents)}</td><td><a href={"/?module=Configurações"} className="icon-button" title="Abrir empresa" aria-label="Abrir empresa"><ExternalLink size={14} aria-hidden="true" /></a></td>
              </tr>
            ))}
          </tbody></table></div>
        </div>
      )}
      {confirmArchive && <div className="vx-dialog-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setConfirmArchive(null); }}><section className="vx-dialog" role="dialog" aria-modal="true" aria-label="Arquivar plano"><header className="vx-dialog-heading"><div><h2>Arquivar plano</h2><p>Empresas vinculadas continuam no plano arquivado; novos não poderão ser contratados.</p></div><button type="button" className="vx-dialog-close" aria-label="Fechar" onClick={() => setConfirmArchive(null)}><X size={16} aria-hidden="true" /></button></header><footer className="vx-dialog-footer"><button type="button" className="secondary-button" onClick={() => setConfirmArchive(null)}>Voltar</button><button type="button" className="danger-button" onClick={() => { void archive(confirmArchive); }}>Arquivar</button></footer></section></div>}
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
    <div className="vx-dialog-backdrop platform-admin-editor-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="vx-dialog platform-admin-editor" role="dialog" aria-modal="true" aria-label={editing ? "Editar plano" : "Novo plano"}>
        <header className="vx-dialog-heading"><span className="vx-dialog-icon"><CircleDollarSign size={18} aria-hidden="true" /></span><div><h2>{editing ? "Editar plano" : "Novo plano / pacote"}</h2><p>{editing ? "Alterações passam a valer na próxima atribuição." : "Defina nome, preço, ciclo e limites."}</p></div><button type="button" className="vx-dialog-close" aria-label="Fechar" onClick={onClose}><X size={17} aria-hidden="true" /></button></header>
        <div className="vx-dialog-body platform-admin-editor-body">
          <div className="platform-admin-editor-grid">
            <label className="platform-admin-field"><span>Nome</span><input autoFocus value={draft.name} onChange={e => upd({ name: e.target.value })} placeholder="Só Sites" /></label>
            <label className="platform-admin-field"><span>Código</span><input value={draft.code} onChange={e => upd({ code: e.target.value.toLowerCase() })} placeholder="sites" /></label>
            <label className="platform-admin-field"><span>Tipo</span><select value={draft.kind} onChange={e => upd({ kind: e.target.value })}><option value="PLAN">Plano</option><option value="PACKAGE">Pacote</option></select></label>
            <label className="platform-admin-field"><span>Ciclo</span><select value={draft.cycle} onChange={e => upd({ cycle: e.target.value })}><option value="MONTH">Mensal</option><option value="YEAR">Anual</option><option value="ONCE">Único</option></select></label>
            <label className="platform-admin-field"><span>Preço (R$)</span><input type="number" min={0} step="0.01" value={(draft.priceCents / 100).toFixed(2)} onChange={e => upd({ priceCents: Math.round((parseFloat(e.target.value) || 0) * 100) })} /></label>
            <label className="platform-admin-field"><span>Ordem</span><input type="number" value={draft.sortOrder} onChange={e => upd({ sortOrder: Number(e.target.value) || 0 })} /></label>
            <label className="platform-admin-field platform-admin-field-wide"><span>Tagline</span><input value={draft.tagline} onChange={e => upd({ tagline: e.target.value })} placeholder="Site profissional em 24h" /></label>
            <label className="platform-admin-field platform-admin-field-wide"><span>Descrição</span><textarea rows={2} value={draft.description} onChange={e => upd({ description: e.target.value })} placeholder="O que está incluído, benefícios, garantias…" /></label>
            <label className="platform-admin-field platform-admin-field-wide"><span>Público-alvo</span><input value={draft.audience} onChange={e => upd({ audience: e.target.value })} placeholder="Restaurantes, clínicas…" /></label>
          </div>
          <fieldset className="platform-admin-limits-fieldset"><legend>Limites e recursos</legend><div className="platform-admin-limits-grid">{LIMIT_FIELDS.map(f => f.kind === "bool" ? (<label key={f.key} className="platform-admin-check"><input type="checkbox" checked={!!draft.limits?.[f.key]} onChange={e => upd({ limits: { ...draft.limits, [f.key]: e.target.checked } })} /> <span>{f.label}</span></label>) : (<label key={f.key} className="platform-admin-field"><span>{f.label}</span><input type={f.kind === "number" ? "number" : "text"} min={0} value={draft.limits?.[f.key] ?? ""} onChange={e => setLimit(f.key, f.kind === "number" ? Number(e.target.value) || 0 : e.target.value)} placeholder={f.placeholder} /></label>))}</div>
            <div className="platform-admin-modules-block">
              <div className="platform-admin-modules-head"><span className="platform-admin-field-wide"><strong>Módulos liberados</strong><small>Landing Pages e Formulários entram no pacote <em>Sites</em>. Publicação social fica só com <em>Marketing</em>.</small></span><div className="platform-admin-presets">{PLAN_PRESETS.map(preset => <button key={preset.label} type="button" className="secondary-button" onClick={() => upd({ limits: { ...draft.limits, modules: [...preset.modules, "SETTINGS"] } })} title={"Preencher com " + preset.label}>{preset.label}</button>)}</div></div>
              <div className="platform-admin-modules-grid" role="group" aria-label="Módulos liberados">
                {MODULE_ORDER.filter(m => m !== "SETTINGS").map(m => {
                  const checked = strArr(draft.limits?.modules).includes(m);
                  return (
                    <label key={m} className={"platform-admin-module-check" + (checked ? " is-checked" : "")}>
                      <input type="checkbox" checked={checked} onChange={e => { const current = strArr(draft.limits?.modules).filter(x => x !== "SETTINGS"); const next = e.target.checked ? [...current, m] : current.filter(x => x !== m); upd({ limits: { ...draft.limits, modules: [...next, "SETTINGS"] } }); }} />
                      <span>{MODULE_LABELS[m] || m}<small>{m}</small></span>
                    </label>
                  );
                })}
              </div>
            </div>
          </fieldset>
          <div className="platform-admin-flags"><label className="platform-admin-check"><input type="checkbox" checked={draft.isActive} onChange={e => upd({ isActive: e.target.checked })} /> <span>Plano ativo</span></label><label className="platform-admin-check"><input type="checkbox" checked={draft.isPublic} onChange={e => upd({ isPublic: e.target.checked })} /> <span>Visível no catálogo público</span></label></div>
        </div>
        <footer className="vx-dialog-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="button" className="primary-button" disabled={saving || !draft.name.trim() || !draft.code.trim()} onClick={() => void onSave()}>{saving ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />} Salvar</button></footer>
      </section>
    </div>,
    document.body,
  );
}
