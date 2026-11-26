"use client";

import { useEffect, useState } from "react";

type FollowUpVariant = { id: string; text: string };
type FollowUpPolicy = {
  enabled: boolean;
  timeZone: string;
  steps: number[];
  minIntervalMinutes: number;
  quietStartHour: number;
  quietEndHour: number;
  maxPerDay: number;
  optOutRespected: true;
  suspendOnPayment: boolean;
  variants: FollowUpVariant[];
};

const pageTw = "grid gap-token self-start";
const headingTw = "flex flex-wrap items-start justify-between gap-4 rounded-token-lg border border-line bg-linear-to-br from-blue-50 to-surface p-5 px-6";
const pillTw = "inline-flex min-h-7 flex-none items-center rounded-fin-pill border border-amber-600/35 bg-amber-100 px-3 text-2xs font-extrabold uppercase tracking-fin-wide text-amber-600";
const gridTw = "grid grid-cols-fin-automation items-start gap-token";
const cardTw = "grid min-w-0 content-start gap-3 self-start rounded-token border border-line bg-surface p-pad shadow-token p-4 px-5";
const checkTw = "flex cursor-pointer items-center gap-2.5 rounded-fin-row border border-line bg-surface-2 p-3 text-body font-semibold text-ink transition-colors hover:border-line-strong";
const fieldTw = "grid gap-1.5 text-asaas-label font-bold uppercase tracking-fin-label text-ink-secondary";
const controlTw = "min-h-control-h min-w-0 rounded-fin-row border border-line bg-surface-2 px-2.5 text-body text-ink";
const textareaTw = "min-h-fin-textarea w-full resize-y whitespace-pre-wrap rounded-fin-row border border-line bg-surface-2 px-3 py-2.5 text-body leading-relaxed text-ink";
const noteTw = "m-0 text-asaas-muted leading-relaxed text-ink-secondary";
const strategyTw = "m-0 rounded-fin-row border border-line border-l-4 border-l-blue-600 bg-surface-2 p-3";
const wideTw = "grid grid-cols-1 gap-token md:grid-cols-2";
const previewTw = "rounded-fin-preview border border-dashed border-line-strong bg-blue-50/60 p-3.5";
const primaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";

const DEFAULT_POLICY: FollowUpPolicy = {
  enabled: false,
  timeZone: "America/Sao_Paulo",
  steps: [-5, -3, 0, 2, 5],
  minIntervalMinutes: 1440,
  quietStartHour: 20,
  quietEndHour: 8,
  maxPerDay: 3,
  optOutRespected: true,
  suspendOnPayment: true,
  variants: [
    { id: "v1", text: "Olá, {{nome}}! Sua cobrança de {{valor}} vence em {{vencimento}}. Consulte sua fatura: {{fatura}}." },
    { id: "v2", text: "Olá, {{nome}}! Sua cobrança de {{valor}} vence hoje. Segue a fatura: {{fatura}}." },
    { id: "v3", text: "Olá, {{nome}}! Identificamos uma cobrança vencida em {{vencimento}}. Podemos ajudar? {{fatura}}" },
    { id: "v4", text: "Olá, {{nome}}! Sua cobrança de {{valor}} continua em aberto. Para regularizar, acesse: {{fatura}}." },
    { id: "v5", text: "Olá, {{nome}}! Estamos à disposição para ajudar com sua cobrança pendente. Confira: {{fatura}}." },
  ],
};

const hourToTime = (hour: number) => String(hour).padStart(2, "0") + ":00";
const timeToHour = (value: string) => Number(value.slice(0, 2));

export function FinanceFollowUpPolicyWorkspace() {
  const [policy, setPolicy] = useState<FollowUpPolicy>(DEFAULT_POLICY);
  const [stepsText, setStepsText] = useState(DEFAULT_POLICY.steps.join(","));
  const [intervalHours, setIntervalHours] = useState("24");
  const [quietStart, setQuietStart] = useState(hourToTime(DEFAULT_POLICY.quietStartHour));
  const [quietEnd, setQuietEnd] = useState(hourToTime(DEFAULT_POLICY.quietEndHour));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/backend/finance/follow-up-policy", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "Não foi possível carregar a política de follow-up.");
        return body as FollowUpPolicy;
      })
      .then((loaded) => {
        if (!live) return;
        setPolicy(loaded);
        setStepsText(loaded.steps.join(","));
        setIntervalHours(String(loaded.minIntervalMinutes / 60));
        setQuietStart(hourToTime(loaded.quietStartHour));
        setQuietEnd(hourToTime(loaded.quietEndHour));
      })
      .catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : "Falha ao carregar a política de follow-up."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    const hours = Math.round(Number(intervalHours));
    const steps = stepsText.split(",").map((item) => Math.round(Number(item.trim()))).filter((day) => Number.isFinite(day) && day >= -30 && day <= 30);
    const payload: FollowUpPolicy = {
      ...policy,
      steps,
      minIntervalMinutes: Math.min(10080, Math.max(60, Number.isFinite(hours) ? hours * 60 : 1440)),
      quietStartHour: timeToHour(quietStart),
      quietEndHour: timeToHour(quietEnd),
    };
    try {
      const response = await fetch("/api/backend/finance/follow-up-policy", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Não foi possível salvar a política de follow-up.");
      setPolicy(body as FollowUpPolicy);
      setNotice("Política salva no servidor. Nenhum envio foi feito.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar a política de follow-up.");
    } finally {
      setSaving(false);
    }
  }

  const preview = (policy.variants[0]?.text || "")
    .replace("{{nome}}", "Cliente")
    .replace("{{valor}}", "R$ 100,00")
    .replace("{{vencimento}}", "10/12")
    .replace("{{fatura}}", "link da fatura");

  return <section className={pageTw} aria-labelledby="finance-follow-up-title">
    <header className={headingTw}>
      <div>
        <h2 id="finance-follow-up-title">Automação financeira</h2>
        <p>Configure a régua de cobrança. Salvar não dispara mensagens: o envio dependerá de um executor validado.</p>
      </div>
      <span className={pillTw}>Configuração salva · nenhum envio automático</span>
    </header>
    {error ? <p role="alert" className={noteTw}>{error}</p> : null}
    {notice ? <p role="status" className={noteTw}>{notice}</p> : null}
    <div className={gridTw}>
      <section className={cardTw}>
        <h3>Régua e janela</h3>
        <label className={checkTw}><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy((current) => ({ ...current, enabled: event.target.checked }))}/> Preparar avisos automáticos</label>
        <label className={fieldTw}>Fuso horário<select className={controlTw} value={policy.timeZone} onChange={(event) => setPolicy((current) => ({ ...current, timeZone: event.target.value }))}><option value="America/Sao_Paulo">Brasília / São Paulo</option><option value="America/Cuiaba">Cuiabá</option><option value="America/Manaus">Manaus</option></select></label>
        <label className={fieldTw}>Dias em relação ao vencimento<input className={controlTw} value={stepsText} onChange={(event) => setStepsText(event.target.value)} placeholder="-5, -3, 0, 2, 5"/></label>
        <label className={fieldTw}>Intervalo mínimo entre avisos (horas)<input className={controlTw} inputMode="numeric" value={intervalHours} onChange={(event) => setIntervalHours(event.target.value)}/></label>
        <div className={gridTw}>
          <label className={fieldTw}>Início da janela silenciosa<input className={controlTw} type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)}/></label>
          <label className={fieldTw}>Fim da janela silenciosa<input className={controlTw} type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)}/></label>
        </div>
        <label className={fieldTw}>Máximo de avisos por dia<input className={controlTw} inputMode="numeric" value={policy.maxPerDay} onChange={(event) => setPolicy((current) => ({ ...current, maxPerDay: Number(event.target.value) }))}/></label>
        <label className={checkTw}><input type="checkbox" checked={policy.suspendOnPayment} onChange={(event) => setPolicy((current) => ({ ...current, suspendOnPayment: event.target.checked }))}/> Suspender a régua após pagamento confirmado</label>
        <p className={noteTw}>Negativos são dias antes do vencimento. O opt-out do cliente é sempre respeitado e não pode ser desligado aqui.</p>
      </section>
      <section className={cardTw}>
        <h3>Segurança e integração</h3>
        <div className={strategyTw}><strong>Antes de qualquer envio futuro</strong><p>Revalidar pagamento, consentimento, canal autorizado, janela de contato e duplicidade. A escolha da variante é determinística por contato e tentativa.</p></div>
        <div className={strategyTw}><strong>Integração entre módulos</strong><p>A régua usará contatos do CRM, cobranças do provedor, canais do Atendimento e registros auditáveis no Histórico.</p></div>
        <div className={previewTw}><strong>Prévia da primeira variante</strong><p>{preview || "Digite uma variante para visualizar."}</p></div>
        <p className={noteTw}>{loading ? "Carregando política salva…" : "Alterações de configuração são registradas na auditoria da empresa."}</p>
      </section>
      <section className={wideTw}>
        <div className={cardTw}>
          <h3>Variantes de texto</h3>
          <p className={noteTw}>Mínimo de 5 variantes. A seleção por contato e tentativa evita repetição previsível sem depender de IA.</p>
          {policy.variants.map((variant, index) => <label className={fieldTw} key={variant.id}>Variante {index + 1}<textarea className={textareaTw} rows={2} value={variant.text} onChange={(event) => setPolicy((current) => ({ ...current, variants: current.variants.map((entry, position) => position === index ? { ...entry, text: event.target.value } : entry) }))}/></label>)}
          {policy.variants.length < 10 ? <button type="button" className={secondaryButton} onClick={() => setPolicy((current) => ({ ...current, variants: [...current.variants, { id: "v" + (current.variants.length + 1) + "-" + Date.now().toString(36), text: "" }] }))}>Adicionar variante</button> : null}
        </div>
        <div className={cardTw}>
          <h3>Variáveis e prévia</h3>
          <p className={noteTw}>Variáveis: {"{{nome}}"}, {"{{valor}}"}, {"{{vencimento}}"}, {"{{fatura}}"}, {"{{empresa}}"}</p>
          <div className={previewTw}><strong>Texto que o cliente veria</strong><p>{preview || "Digite uma variante para visualizar."}</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryButton} disabled={saving || loading || policy.variants.length < 5} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar política"}</button>
            <button type="button" className={secondaryButton} disabled={saving} onClick={() => { setPolicy(DEFAULT_POLICY); setStepsText(DEFAULT_POLICY.steps.join(",")); setIntervalHours("24"); setQuietStart(hourToTime(DEFAULT_POLICY.quietStartHour)); setQuietEnd(hourToTime(DEFAULT_POLICY.quietEndHour)); }}>Restaurar padrão</button>
          </div>
        </div>
      </section>
    </div>
  </section>;
}
