"use client";
import { useEffect, useState } from "react";
import { Check, ChevronRight, Sparkles, X, ClipboardList } from "lucide-react";

type Step = {
  id: string;
  title: string;
  hint: string;
  target: string;
  done: boolean;
  loading: boolean;
};

const DISMISS_KEY = "vexora:onboarding-dismissed";

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function OnboardingChecklist({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    try { if (localStorage.getItem(DISMISS_KEY) === "1") { setDismissed(true); setReady(true); return; } } catch {}
    let live = true;
    const init: Step[] = [
      { id: "empresa", title: "Complete os Dados da empresa", hint: "Nome, CNPJ e endereço — usados em cobranças e contratos", target: "Configurações", done: false, loading: true },
      { id: "canais", title: "Conecte seu WhatsApp ou Instagram", hint: "Com a equipe atendendo no mesmo lugar", target: "Conexões", done: false, loading: true },
      { id: "equipe", title: "Convide sua equipe", hint: "Atendentes com os módulos certos desde o início", target: "Atendentes", done: false, loading: true },
      { id: "documento", title: "Gere o primeiro orçamento", hint: "Orçamento, contrato ou OS em um clique", target: "Documentos", done: false, loading: true },
    ];
    setSteps(init);
    setReady(true);
    Promise.all([
      safeFetch<{ cnpj?: string }>("/api/backend/auth/organization"),
      safeFetch<Array<{ status?: string }>>("/api/backend/channels"),
      safeFetch<Array<unknown>>("/api/backend/team"),
      safeFetch<{ documents?: Array<unknown> }>("/api/backend/documents/recent?limit=1"),
    ]).then(([org, channels, team, docs]) => {
      if (!live) return;
      setSteps((current) => current.map((step) => {
        if (step.id === "empresa") return { ...step, done: Boolean(org?.cnpj?.replace(/\D/g, "")), loading: false };
        if (step.id === "canais") return { ...step, done: Boolean(channels?.some((channel) => String(channel.status).toUpperCase() === "CONNECTED")), loading: false };
        if (step.id === "equipe") return { ...step, done: Boolean(team && team.length >= 2), loading: false };
        if (step.id === "documento") return { ...step, done: Boolean(docs?.documents && docs.documents.length > 0), loading: false };
        return step;
      }));
    });
    return () => { live = false; };
  }, []);

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  if (dismissed || (allDone && ready)) return null;

  return (
    <section className="ov-onboarding" aria-label="Primeiros passos na Véxora">
      <div className="ov-onboarding-head">
        <div className="ov-onboarding-title">
          <Sparkles size={18} aria-hidden="true" />
          <div>
            <h2>Bem-vindo à Véxora — primeiros passos</h2>
            <p>{allDone ? "Tudo pronto! Sua operação está calibrada." : `${doneCount} de ${steps.length} concluídos`}</p>
          </div>
        </div>
        <button type="button" className="ov-onboarding-dismiss" aria-label="Dispensar checklist" onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} setDismissed(true); }}><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="ov-onboarding-bar" aria-hidden="true"><span style={{ width: (steps.length ? (doneCount / steps.length) * 100 : 0) + "%" }} /></div>
      <ol className="ov-onboarding-steps">
        {steps.map((step) => (
          <li key={step.id} className={"ov-onboarding-step" + (step.done ? " is-done" : "")}>
            <span className="ov-onboarding-check" aria-hidden="true">{step.done ? <Check size={14} strokeWidth={3} /> : <ClipboardList size={14} />}</span>
            <span className="ov-onboarding-copy"><strong>{step.title}</strong><small>{step.hint}</small></span>
            <button type="button" className="ov-onboarding-go" onClick={() => onNavigate(step.target)} disabled={step.loading}>Configurar <ChevronRight size={14} aria-hidden="true" /></button>
          </li>
        ))}
      </ol>
    </section>
  );
}
