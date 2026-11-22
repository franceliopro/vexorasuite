"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Star, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

type Plan = { id: string; code: string; kind: string; name: string; tagline: string; description: string; audience: string; priceCents: number; currency: string; cycle: string; limits: any; isPublic: boolean };
const CUSTOM_PLAN_CODE = "personalizado";
const PRICE = (cents: number, cycle = "MONTH") => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + (cycle === "YEAR" ? "/ano" : cycle === "MONTH" ? "/mês" : "");
const BENEFIT_KEYS: Array<[string, string]> = [ ["attendants","Atendentes"],["bots","Robôs com IA"],["ia","Crédito de IA / mês"],["sites","Sites incluídos"],["dynamic","Site dinâmico (posts/imóveis)"],["forms","Formulários de captura"],["socialAccounts","Redes vinculadas"],["whatsapp","WhatsApp vinculado"],["crm","CRM completo"],["finance","Financeiro Asaas"],["followups","Follow-ups / cobrança"],["marketingPublishing","Publicação automática"] ];
const MODULE_LABEL: Record<string, string> = { INBOX: "Atendimento", CRM: "CRM", AUTOMATION: "Chatbot / IA", MARKETING: "Marketing", SITES: "Sites", FINANCE: "Financeiro", CHANNELS: "Canais", CALENDAR: "Agenda", TASKS: "Tarefas", SETTINGS: "Configurações" };
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const textButtonTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600 transition-colors hover:bg-surface hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const shellTw = "grid gap-4";
const heroTw = "flex items-center justify-between gap-4.5 rounded-token-lg border border-line bg-blue-50 px-plans-hero-x py-plans-hero-y";
const eyebrowTw = "inline-flex items-center gap-1.5 font-display text-plans-eyebrow font-extrabold uppercase text-blue-800";
const heroTitleTw = "m-1.5 mb-1 font-display text-plans-price font-extrabold tracking-tight text-ink";
const heroCopyTw = "m-0 max-w-plans-copy text-docs-hint text-ink-secondary";
const errorTw = "m-0 rounded-catalog-metric border border-red-600 bg-red-100 px-3 py-2.5 text-docs-hint text-red-600";
const noticeTw = "m-0 max-w-plans-notice rounded-catalog-metric border border-line-strong bg-surface-2 p-2.5 text-body text-ink";
const loadingTw = "flex items-center justify-center gap-2.5 p-7.5 text-ink-secondary";
const gridTw = "grid grid-cols-plans gap-3.5";
const cardTw = "relative grid gap-2.25 rounded-token-lg border border-line bg-surface p-plans-card-pad transition-transform hover:-translate-y-0.5 hover:shadow-token-lg";
const cardFeaturedTw = "border-blue-600 ring-4 ring-blue-100";
const cardCurrentTw = "bg-blue-50";
const badgeTw = "absolute -top-2.5 right-3.5 inline-flex items-center gap-1 rounded-cf-tag bg-blue-600 px-plans-badge-x py-plans-badge-y font-display text-plans-badge font-extrabold text-blue-50";
const cardHeaderTw = "flex justify-between gap-2";
const kindTw = "font-display text-plans-eyebrow font-extrabold uppercase text-ink-secondary";
const currentTw = "inline-flex items-center gap-1 font-display text-plans-badge font-extrabold uppercase text-blue-600";
const cardTitleTw = "m-0 font-display text-plans-title font-extrabold text-ink";
const taglineTw = "m-0 min-h-7.5 text-docs-meta text-ink-secondary";
const priceTw = "flex items-baseline gap-2";
const priceValueTw = "font-display text-plans-price font-extrabold tabular-nums text-ink";
const priceNoteTw = "text-plans-meta text-ink-secondary";
const benefitsTw = "m-0 grid list-none gap-1.25 border-y border-line px-0 py-2.5";
const benefitTw = "flex items-center gap-1.75 text-plans-meta text-ink";
const benefitOffTw = "text-ink-muted opacity-50";
const benefitIconTw = "flex-none text-blue-600";
const benefitCountTw = "ml-auto tabular-nums text-catalog-metric text-ink";
const modulesTw = "m-0 text-plans-modules text-ink-secondary";
const cardFooterTw = "flex justify-end";
const actionsTw = "flex flex-col gap-2";
const footnoteTw = "m-0 text-plans-footnote text-ink-secondary";
const cardVariantTw: Record<"normal" | "featured" | "current" | "featured-current", string> = {
  normal: cardTw,
  featured: `${cardTw} ${cardFeaturedTw}`,
  current: `${cardTw} ${cardCurrentTw}`,
  "featured-current": `${cardTw} ${cardFeaturedTw} ${cardCurrentTw}`,
};

export function ClientPlansWorkspace({ currentPlanCode, currentPlanName }: { currentPlanCode?: string | null; currentPlanName?: string | null }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activating, setActivating] = useState<string | null>(null);
  const [activateNotice, setActivateNotice] = useState("");

  async function activate(code: string, planName: string) {
    setActivating(code); setActivateNotice("");
    try {
      const response = await fetch("/api/backend/billing/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planCode: code }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 424) { setActivateNotice(typeof data?.message === "string" ? data.message : "A cobrança automática está indisponível — fale com o comercial."); return; }
      if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Falha ao iniciar a cobrança.");
      setActivateNotice(data?.paymentUrl ? `Cobrança de ${planName} criada. Abrindo a fatura em uma nova aba — o plano é ativado automaticamente assim que o pagamento for confirmado.` : `Cobrança de ${planName} criada. O plano é ativado automaticamente assim que o pagamento for confirmado.`);
      if (typeof data?.paymentUrl === "string" && data.paymentUrl) window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setActivateNotice(caught instanceof Error ? caught.message : "Falha ao iniciar a cobrança.");
    } finally {
      setActivating(null);
    }
  }
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
  if (loading) return <div className={loadingTw}><Loader2 size={20} className="animate-spin" aria-hidden="true" /> Carregando planos…</div>;
  return (
    <section className={shellTw}>
      <header className={heroTw}>
        <div><span className={eyebrowTw}><Sparkles size={13} aria-hidden="true" /> Planos e preços</span><h1 className={heroTitleTw}>Escolha o próximo passo</h1><p className={heroCopyTw}>Sua empresa já está no plano <strong>{currentPlanName || "atual"}</strong>. Você pode mudar de plano a qualquer momento — a Véxora aplica tudo na hora.</p></div>
        <a className={primaryTw} href="https://wa.me/5562999990000?text=Quero%20revisar%20o%20meu%20plano%20na%20V%C3%A9xora" target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true" /> Falar com a Véxora</a>
      </header>
      {error && <p className={errorTw} role="alert">{error}</p>}
      {activateNotice ? <p role="status" className={noticeTw}>{activateNotice}</p> : null}
      <div className={gridTw}>
        {plans.map(p => (
          <article key={p.id} className={cardVariantTw[featured?.id === p.id ? (currentPlanCode === p.code ? "featured-current" : "featured") : (currentPlanCode === p.code ? "current" : "normal")]}>
            {featured?.id === p.id && <span className={badgeTw}><Star size={12} aria-hidden="true" /> Mais escolhido</span>}
            <header className={cardHeaderTw}><span className={kindTw}>{p.code === CUSTOM_PLAN_CODE ? "Personalizado" : p.kind === "PACKAGE" ? "Pacote" : "Plano"}</span>{currentPlanCode === p.code ? <span className={currentTw}><ShieldCheck size={12} aria-hidden="true" /> Seu plano</span> : null}</header>
            <h2 className={cardTitleTw}>{p.name}</h2>
            {p.tagline && <p className={taglineTw}>{p.tagline}</p>}
            <div className={priceTw}><b className={priceValueTw}>{p.code === CUSTOM_PLAN_CODE ? "Sob consulta" : PRICE(p.priceCents, p.cycle)}</b><small className={priceNoteTw}>{p.code === CUSTOM_PLAN_CODE ? "contratado com a Véxora" : p.cycle === "YEAR" ? "cobrança anual" : p.cycle === "MONTH" ? "cobrança mensal" : "cobrança única"}</small></div>
            {p.code === CUSTOM_PLAN_CODE ? (
              <p className={modulesTw}>{p.description}</p>
            ) : (
              <>
                <ul className={benefitsTw}>{BENEFIT_KEYS.map(([key, label]) => { const v = p.limits?.[key]; const on = typeof v === "boolean" ? v : typeof v === "number" ? v > 0 : !!v; return <li key={key} className={on ? benefitTw : `${benefitTw} ${benefitOffTw}`}><Check size={13} aria-hidden="true" className={benefitIconTw} /> <span>{label}</span>{typeof v === "number" && v > 0 ? <b className={benefitCountTw}>{v}</b> : null}</li>; })}</ul>
                <p className={modulesTw}>{Array.isArray(p.limits?.modules) ? p.limits.modules.map((m: string) => MODULE_LABEL[m] || m).join(" · ") : ""}</p>
              </>
            )}
            <footer className={cardFooterTw}>
              {p.code === CUSTOM_PLAN_CODE ? (
                <a className={primaryTw} href="https://wa.me/5562999990000?text=Quero%20um%20plano%20personalizado%20na%20V%C3%A9xora" target="_blank" rel="noopener noreferrer">Falar com a Véxora</a>
              ) : currentPlanCode === p.code ? (
                <a className={secondaryTw} href={"https://wa.me/5562999990000?text=Quero%20revisar%20o%20meu%20plano%20" + encodeURIComponent(p.name)} target="_blank" rel="noopener noreferrer">Revisar plano</a>
              ) : (
                <div className={actionsTw}>
                  <button type="button" className={primaryTw} disabled={activating === p.code} onClick={() => void activate(p.code, p.name)}>{activating === p.code ? "Gerando cobrança…" : "Ativar agora"}</button>
                  <a className={textButtonTw} href={"https://wa.me/5562999990000?text=Quero%20ativar%20o%20plano%20" + encodeURIComponent(p.name)} target="_blank" rel="noopener noreferrer">Fale com a Véxora</a>
                </div>
              )}
            </footer>
          </article>
        ))}
      </div>
      <p className={footnoteTw}>Preços em reais, cobrança mensal ou anual com 2 meses de desconto no plano anual. Troca de plano sem perda de dados: a Véxora aplica as novas permissões em até 5 minutos úteis.</p>
    </section>
  );
}
