"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Star, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

type Plan = { id: string; code: string; kind: string; name: string; tagline: string; description: string; audience: string; priceCents: number; currency: string; cycle: string; limits: any; isPublic: boolean };
const PRICE = (cents: number, cycle = "MONTH") => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + (cycle === "YEAR" ? "/ano" : cycle === "MONTH" ? "/mês" : "");
const BENEFIT_KEYS: Array<[string, string]> = [ ["attendants","Atendentes"],["bots","Robôs com IA"],["ia","Crédito de IA / mês"],["sites","Sites incluídos"],["dynamic","Site dinâmico (posts/imóveis)"],["forms","Formulários de captura"],["socialAccounts","Redes vinculadas"],["whatsapp","WhatsApp vinculado"],["crm","CRM completo"],["finance","Financeiro Asaas"],["followups","Follow-ups / cobrança"],["marketingPublishing","Publicação automática"] ];
const MODULE_LABEL: Record<string, string> = { SITES: "Sites", INBOX: "Atendimento", CRM: "CRM", AUTOMATION: "Chatbot / IA", MARKETING: "Marketing", FINANCE: "Financeiro", CHANNELS: "Canais", CALENDAR: "Agenda", TASKS: "Tarefas", SETTINGS: "Configurações" };

export function ClientPlansWorkspace({ currentPlanCode, currentPlanName }: { currentPlanCode?: string | null; currentPlanName?: string | null }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    fetch("/api/backend/plans", { cache: "no-store" })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.message || "Não foi possível carregar os planos."); return data; })
      .then(data => { if (mounted) { setPlans((data.plans || []).filter((p: Plan) => p.isPublic)); setError(""); } })
      .catch(e => { if (mounted) setError(e instanceof Error ? e.message : "Não foi possível carregar os planos."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  const featured = useMemo(() => plans.find(p => p.kind === "PLAN" && p.priceCents >= 30000 && p.priceCents <= 40000) || plans.find(p => p.kind === "PLAN" && p.isPublic) || plans[0], [plans]);
  if (loading) return <div className="client-plans-loading"><Loader2 size={20} className="vx-spin" aria-hidden="true" /> Carregando planos…</div>;
  return (
    <section className="client-plans">
      <header className="client-plans-hero">
        <div><span className="client-plans-eyebrow"><Sparkles size={13} aria-hidden="true" /> Planos e preços</span><h1>Escolha o próximo passo</h1><p>Sua empresa já está no plano <strong>{currentPlanName || "atual"}</strong>. Você pode mudar de plano a qualquer momento — a Véxora aplica tudo na hora.</p></div>
        <a className="primary-button" href="https://wa.me/5562999990000?text=Quero%20revisar%20o%20meu%20plano%20na%20V%C3%A9xora" target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true" /> Falar com a Véxora</a>
      </header>
      {error && <p className="client-plans-error" role="alert">{error}</p>}
      <div className="client-plans-grid">
        {plans.map(p => (
          <article key={p.id} className={"client-plan-card " + (featured?.id === p.id ? "is-featured" : "") + (currentPlanCode === p.code ? " is-current" : "")}>
            {featured?.id === p.id && <span className="client-plan-badge"><Star size={12} aria-hidden="true" /> Mais escolhido</span>}
            <header><span className="client-plan-kind">{p.kind === "PACKAGE" ? "Pacote" : "Plano"}</span>{currentPlanCode === p.code ? <span className="client-plan-current"><ShieldCheck size={12} aria-hidden="true" /> Seu plano</span> : null}</header>
            <h2>{p.name}</h2>
            {p.tagline && <p className="client-plan-tagline">{p.tagline}</p>}
            <div className="client-plan-price"><b>{PRICE(p.priceCents, p.cycle)}</b><small>{p.cycle === "YEAR" ? "cobrança anual" : p.cycle === "MONTH" ? "cobrança mensal" : "cobrança única"}</small></div>
            <ul className="client-plan-benefits">{BENEFIT_KEYS.map(([key, label]) => { const v = p.limits?.[key]; const on = typeof v === "boolean" ? v : typeof v === "number" ? v > 0 : !!v; return <li key={key} className={on ? "" : "is-off"}><Check size={13} aria-hidden="true" /> <span>{label}</span>{typeof v === "number" && v > 0 ? <b>{v}</b> : null}</li>; })}</ul>
            <p className="client-plan-modules">{Array.isArray(p.limits?.modules) ? p.limits.modules.map((m: string) => MODULE_LABEL[m] || m).join(" · ") : ""}</p>
            <footer><a className="secondary-button" href={"https://wa.me/5562999990000?text=Quero%20ativar%20o%20plano%20" + encodeURIComponent(p.name)} target="_blank" rel="noopener noreferrer">{currentPlanCode === p.code ? "Adicionar serviços" : "Quero este plano"}</a></footer>
          </article>
        ))}
      </div>
      <p className="client-plans-footnote">Preços em reais, cobrança mensal ou anual com 2 meses de desconto no plano anual. Troca de plano sem perda de dados: a Véxora aplica as novas permissões em até 5 minutos úteis.</p>
    </section>
  );
}
