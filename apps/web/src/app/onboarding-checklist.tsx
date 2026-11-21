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
    <section className="grid content-start gap-4 rounded-token-lg border border-gray-200 bg-zinc-200 p-5" aria-label="Primeiros passos na Véxora">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 text-blue-600">
          <Sparkles size={18} aria-hidden="true" />
          <div>
            <h2 className="text-ov-onboarding font-heading text-slate-950">Bem-vindo à Véxora — primeiros passos</h2>
            <p className="text-small text-slate-600">{allDone ? "Tudo pronto! Sua operação está calibrada." : `${doneCount} de ${steps.length} concluídos`}</p>
          </div>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-token-sm border border-gray-200 bg-zinc-100 text-slate-600 transition-control duration-control hover:bg-zinc-300" aria-label="Dispensar checklist" onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} setDismissed(true); }}><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-300" aria-hidden="true"><span className="block h-full rounded-full bg-linear-to-r from-blue-600 to-sky-600 transition-fill duration-bar ease-token" style={{ width: (steps.length ? (doneCount / steps.length) * 100 : 0) + "%" }} /></div>
      <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.id} className="grid grid-cols-ov-step items-center gap-3 rounded-token-sm border border-gray-200 bg-zinc-100 p-4">
            <span className={`grid h-7 w-7 place-items-center rounded-full ${step.done ? "bg-emerald-100 text-emerald-600" : "bg-zinc-300 text-slate-600"}`} aria-hidden="true">{step.done ? <Check size={14} strokeWidth={3} /> : <ClipboardList size={14} />}</span>
            <span className="grid min-w-0"><strong className="truncate text-small font-bold text-slate-950">{step.title}</strong><small className="truncate text-ov-micro text-slate-600">{step.hint}</small></span>
            <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-token-sm border border-gray-200 bg-zinc-100 px-2.5 text-ov-micro font-bold text-slate-600 transition-control duration-control hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => onNavigate(step.target)} disabled={step.loading}>Configurar <ChevronRight size={14} aria-hidden="true" /></button>
          </li>
        ))}
      </ol>
    </section>
  );
}
