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
const stepIconTw: Record<string, string> = {
  done: "grid h-6 w-6 flex-none place-items-center rounded-full bg-emerald-400/20 text-emerald-700 dark:text-emerald-300",
  pending: "grid h-6 w-6 flex-none place-items-center rounded-full bg-blue-400/20 text-blue-700 dark:text-blue-300",
};

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
    <section className="grid w-full content-start gap-3 bg-transparent p-4 text-slate-800 hover:bg-transparent dark:text-slate-100" aria-label="Primeiros passos na Véxora">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <Sparkles size={16} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-50">Bem-vindo à Véxora — primeiros passos</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">{allDone ? "Tudo pronto! Sua operação está calibrada." : `${doneCount} de ${steps.length} concluídos`}</p>
        </div>
        <button type="button" className="grid h-7 w-7 flex-none place-items-center rounded-lg border border-blue-200 bg-white/70 text-slate-600 transition-colors duration-200 hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Dispensar checklist" onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} setDismissed(true); }}><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-blue-200 dark:bg-slate-700" aria-hidden="true"><span className="block h-full rounded-full bg-linear-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out" style={{ width: (steps.length ? (doneCount / steps.length) * 100 : 0) + "%" }} /></div>
      <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-transparent px-3 py-2 dark:border-slate-600 dark:bg-slate-700">
            <span className={stepIconTw[step.done ? "done" : "pending"]} aria-hidden="true">{step.done ? <Check size={14} strokeWidth={3} /> : <ClipboardList size={14} />}</span>
            <span className="grid min-w-0 flex-1"><strong className="truncate text-xs font-bold text-slate-800 dark:text-slate-50">{step.title}</strong><small className="truncate text-xs text-slate-600 dark:text-slate-300">{step.hint}</small></span>
            <button type="button" className="inline-flex min-h-7 flex-none items-center gap-1 rounded-lg border border-blue-200 bg-slate-100 px-2 text-xs font-bold text-slate-800 transition-colors duration-200 hover:border-blue-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-50 dark:hover:bg-slate-500" onClick={() => onNavigate(step.target)} disabled={step.loading}>Configurar <ChevronRight size={14} aria-hidden="true" /></button>
          </li>
        ))}
      </ol>
    </section>
  );
}
