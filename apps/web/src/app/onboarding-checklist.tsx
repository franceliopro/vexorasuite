"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Sparkles, X, ClipboardList } from "lucide-react";
import type { SegmentProfile } from "./auth-screen";

type Step = {
  id: string;
  title: string;
  hint: string;
  target: string;
  done: boolean;
  loading: boolean;
};

const ACCENT_STEPS = new Set(["empresa", "documento", "escola", "alunos", "aula", "regras"]);
type SchoolChecklistSnapshot = {
  courses?: Array<unknown>; classes?: Array<unknown>; people?: Array<{ kind?: string }>;
  enrollments?: Array<unknown>; sessions?: Array<unknown>; billingPolicy?: unknown;
};
const stepIconTw = (done: boolean, id: string) => {
  const base = done
    ? "grid h-6 w-6 flex-none place-items-center rounded-full bg-emerald-400/20 text-emerald-700 dark:text-emerald-300"
    : "grid h-6 w-6 flex-none place-items-center rounded-full bg-blue-400/20 text-blue-700 dark:text-blue-300";
  return ACCENT_STEPS.has(id) ? `${base} dark:bg-sky-400/15 dark:text-sky-400` : base;
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

export function OnboardingChecklist({ onNavigate, onDismiss, profile }: { onNavigate: (target: string) => void; onDismiss?: () => void; profile?: SegmentProfile | null }) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const school = profile?.overview === "SCHOOL";
  const dismissKey = "vexora:onboarding-dismissed:" + (profile?.id || "generic");

  useEffect(() => {
    try { if (localStorage.getItem(dismissKey) === "1") { setDismissed(true); setReady(true); onDismissRef.current?.(); return; } } catch {}
    let live = true;
    const init: Step[] = school ? [
      { id: "escola", title: "Cadastre cursos e professores", hint: "Estrutura inicial da gestão escolar", target: "Gestão escolar", done: false, loading: true },
      { id: "alunos", title: "Cadastre alunos e matrículas", hint: "Cada empresa começa com seus próprios dados", target: "Gestão escolar", done: false, loading: true },
      { id: "aula", title: "Registre a primeira aula", hint: "Presença e resumo ficam no histórico do aluno", target: "Gestão escolar", done: false, loading: true },
      { id: "regras", title: "Revise as regras de mensalidade", hint: "Lembretes, multa e cancelamento dependem de aprovação humana", target: "Gestão escolar", done: false, loading: true },
    ] : [
      { id: "empresa", title: "Complete os Dados da empresa", hint: "Nome, CNPJ e endereço — usados em cobranças e contratos", target: "Configurações", done: false, loading: true },
      { id: "canais", title: "Conecte seu WhatsApp ou Instagram", hint: "Com a equipe atendendo no mesmo lugar", target: "Conexões", done: false, loading: true },
      { id: "equipe", title: "Convide sua equipe", hint: "Atendentes com os módulos certos desde o início", target: "Atendentes", done: false, loading: true },
      { id: "documento", title: "Gere o primeiro orçamento", hint: "Orçamento, contrato ou OS em um clique", target: "Documentos", done: false, loading: true },
    ];
    setSteps(init);
    setReady(true);
    if (school) {
      void safeFetch<SchoolChecklistSnapshot>("/api/backend/school/snapshot").then((snapshot) => {
        if (!live) return;
        setSteps((current) => current.map((step) => {
          if (step.id === "escola") return { ...step, done: Boolean(snapshot?.courses?.length && snapshot?.people?.some((person) => person.kind === "TEACHER")), loading: false };
          if (step.id === "alunos") return { ...step, done: Boolean(snapshot?.people?.some((person) => person.kind === "STUDENT") && snapshot?.enrollments?.length), loading: false };
          if (step.id === "aula") return { ...step, done: Boolean(snapshot?.sessions?.length), loading: false };
          if (step.id === "regras") return { ...step, done: Boolean(snapshot?.billingPolicy), loading: false };
          return step;
        }));
      });
      return () => { live = false; };
    }
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
  }, [dismissKey, school]);

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  if (dismissed || (allDone && ready)) return null;

  return (
    <section className="grid w-full content-start gap-3 rounded-xl border border-gray-200 bg-white p-5 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-900" aria-label="Primeiros passos na Véxora">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <Sparkles size={16} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-50">{school ? "Bem-vindo à sua escola — primeiros passos" : "Bem-vindo à Véxora — primeiros passos"}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">{allDone ? (school ? "Tudo pronto! A rotina escolar está organizada." : "Tudo pronto! Sua operação está calibrada.") : `${doneCount} de ${steps.length} concluídos`}</p>
        </div>
        <button type="button" className="grid h-7 w-7 flex-none place-items-center rounded-lg border border-blue-200 bg-white/70 text-slate-600 transition-colors duration-200 hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" aria-label="Dispensar checklist" onClick={() => { try { localStorage.setItem(dismissKey, "1"); } catch {} setDismissed(true); onDismissRef.current?.(); }}><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-blue-200 dark:bg-slate-700" aria-hidden="true"><span className="block h-full rounded-full bg-linear-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out" style={{ width: (steps.length ? (doneCount / steps.length) * 100 : 0) + "%" }} /></div>
      <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-3.5 text-left text-ink dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50">
            <span className={stepIconTw(step.done, step.id)} aria-hidden="true">{step.done ? <Check size={14} strokeWidth={3} /> : <ClipboardList size={14} />}</span>
            <span className="grid min-w-0 flex-1"><strong className="truncate text-xs font-bold text-slate-800 dark:text-slate-50">{step.title}</strong><small className="truncate text-xs text-slate-600 dark:text-slate-300">{step.hint}</small></span>
            <button type="button" className="inline-flex min-h-7 flex-none items-center gap-1 rounded-lg border border-line bg-surface-2 px-2 text-xs font-bold text-ink transition-colors duration-200 hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-sky-400/15 dark:text-sky-400 dark:hover:bg-sky-400/25" onClick={() => onNavigate(step.target)} disabled={step.loading}>Configurar <ChevronRight size={14} aria-hidden="true" /></button>
          </li>
        ))}
      </ol>
    </section>
  );
}
