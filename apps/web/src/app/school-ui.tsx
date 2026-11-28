"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Clock3, Music2, Sparkles, X } from "lucide-react";

/**
 * Design system do segmento music-school, inspirado nas referências enviadas:
 * cards brancos com ícone âmbar em destaque no mobile e botões largos brancos,
 * com ícone à esquerda e sombra sutil, no desktop. Um único modal por vez.
 */
export const schoolTw = {
  shell: "mx-auto grid w-full max-w-[1400px] gap-4 px-4 pb-28 pt-4 sm:px-6",
  hero: "grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-token-sm sm:grid-cols-[1fr_auto] sm:items-center",
  heroTitle: "m-0 text-2xl font-extrabold tracking-tight text-slate-950",
  heroCopy: "mt-1 max-w-2xl text-sm leading-relaxed text-slate-600",
  section: "grid gap-3",
  sectionHead: "flex flex-wrap items-center justify-between gap-2",
  sectionTitle: "m-0 flex items-center gap-2 text-lg font-bold text-slate-950",
  sectionHint: "m-0 text-xs text-slate-500",
  card: "grid min-w-0 content-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-token-sm transition-control duration-control ease-token hover:border-gray-400 hover:shadow-token",
  cardSoft: "grid min-w-0 content-start gap-2 rounded-2xl border border-gray-200 bg-zinc-100 p-4",
  grid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
  tileGrid: "grid grid-cols-4 gap-2.5 sm:grid-cols-4 lg:grid-cols-6",
  tile: "grid min-h-24 place-items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-token-sm transition-control duration-control ease-token hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-token",
  tileIcon: "grid size-12 place-items-center rounded-2xl bg-amber-100 text-amber-600",
  tileLabel: "text-[11px] font-bold leading-tight text-slate-950 sm:text-xs",
  metricGrid: "grid grid-cols-2 gap-3 lg:grid-cols-4",
  metric: "grid min-w-0 gap-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-token-sm",
  metricIcon: "grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700",
  metricLabel: "text-[11px] font-bold uppercase tracking-wider text-slate-600",
  metricValue: "text-3xl font-extrabold leading-none text-slate-950",
  metricHint: "text-xs leading-snug text-slate-600",
  /** Botão principal do segmento: branco, ícone âmbar à esquerda e rótulo em caixa alta. */
  quickButton: "inline-flex min-h-14 w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 text-left shadow-token-sm transition-control duration-control ease-token hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-token disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-56",
  quickIcon: "grid size-10 flex-none place-items-center rounded-xl bg-amber-100 text-amber-600",
  quickCopy: "grid min-w-0 flex-1 gap-0.5",
  quickLabel: "truncate text-xs font-extrabold uppercase tracking-wide text-slate-950",
  quickHint: "truncate text-[11px] text-slate-600",
  button: "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition-control duration-control ease-token hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
  buttonPrimary: "inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white shadow-token-sm transition-control duration-control ease-token hover:-translate-y-0.5 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60",
  buttonSoft: "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-sm font-bold text-slate-700 transition-control duration-control ease-token hover:border-amber-600 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-60",
  buttonGhost: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50",
  buttonDanger: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-100 px-4 text-sm font-bold text-red-600",
  actions: "flex flex-wrap gap-2",
  label: "grid gap-1.5 text-xs font-bold text-slate-600",
  input: "min-h-12 w-full rounded-xl border border-gray-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-600",
  textarea: "min-h-28 w-full rounded-xl border border-gray-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-600",
  select: "min-h-12 w-full appearance-none rounded-xl border border-gray-200 bg-zinc-100 px-3.5 py-2.5 text-sm text-slate-950 focus:border-blue-600",
  chip: "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-slate-600",
  chipActive: "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-blue-600 bg-blue-600 px-3 text-xs font-bold text-white",
  list: "grid gap-2",
  row: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-3",
  empty: "rounded-xl border border-dashed border-gray-300 bg-zinc-100 px-4 py-6 text-center text-sm text-slate-600",
  note: "m-0 text-xs leading-relaxed text-slate-500",
  badge: "inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-extrabold uppercase tracking-wide",
  nav: "fixed inset-x-0 bottom-0 z-[70] grid grid-cols-5 border-t border-gray-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,.08)]",
  navButton: "grid min-h-16 place-items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-zinc-100",
  navButtonActive: "grid min-h-16 place-items-center gap-1 rounded-xl bg-amber-100 px-1 py-2 text-[11px] font-bold text-amber-600",
  backdrop: "fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm",
  panel: "fixed inset-x-3 bottom-3 top-3 z-[81] mx-auto grid max-h-[94dvh] w-full max-w-2xl grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:top-6 sm:bottom-6",
  panelHead: "flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4",
  panelBody: "min-h-0 overflow-y-auto px-5 py-4",
  panelFoot: "flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-zinc-100 px-5 py-3",
  progress: "grid grid-cols-3 gap-2",
  progressStep: "h-1.5 rounded-full bg-gray-200",
  progressDone: "h-1.5 rounded-full bg-amber-600",
} as const;

export type Course = {
  id: string;
  name: string;
  kind?: string;
  parentId?: string | null;
  imageUrl?: string | null;
  summary?: string | null;
  level?: string | null;
  durationLabel?: string | null;
  tuitionAmountCents?: number | null;
};

export const money = (value?: number | null) => typeof value === "number"
  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100)
  : "Sob consulta";

/** A API usa 1=segunda ... 7=domingo, o mesmo padrão das turmas escolares. */
export const weekdayLabel = (value?: number | null) =>
  typeof value === "number" ? ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"][value] || "—" : "—";

export const dateLabel = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
};

export function MetricTile({ icon, label, value, hint, testId, tone = "blue" }: {
  icon: ReactNode; label: string; value: ReactNode; hint: string; testId?: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
  } as const;
  return (
    <article className={schoolTw.metric} data-testid={testId}>
      <span className={`${schoolTw.metricIcon} ${tones[tone]}`} aria-hidden="true">{icon}</span>
      <span className={schoolTw.metricLabel}>{label}</span>
      <strong className={schoolTw.metricValue}>{value}</strong>
      <span className={schoolTw.metricHint}>{hint}</span>
    </article>
  );
}

/** Card/botão de atalho: ícone âmbar centralizado e rótulo abaixo (padrão mobile da referência). */
export function ActionTile({ icon, label, onClick, testId }: {
  icon: ReactNode; label: string; onClick: () => void; testId?: string;
}) {
  return (
    <button type="button" className={schoolTw.tile} onClick={onClick} data-testid={testId}>
      <span className={schoolTw.tileIcon} aria-hidden="true">{icon}</span>
      <span className={schoolTw.tileLabel}>{label}</span>
    </button>
  );
}

/** Botão largo com ícone à esquerda (padrão desktop da referência). */
export function QuickAction({ icon, label, hint, onClick, testId }: {
  icon: ReactNode; label: string; hint?: string; onClick: () => void; testId?: string;
}) {
  return (
    <button type="button" className={schoolTw.quickButton} onClick={onClick} data-testid={testId}>
      <span className={schoolTw.quickIcon} aria-hidden="true">{icon}</span>
      <span className={schoolTw.quickCopy}>
        <span className={schoolTw.quickLabel}>{label}</span>
        {hint ? <span className={schoolTw.quickHint}>{hint}</span> : null}
      </span>
      <ArrowRight size={16} aria-hidden="true" className="text-slate-400" />
    </button>
  );
}

export function BarChart({ title, values, captions, testId }: {
  title: string; values: number[]; captions: string[]; testId?: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-token-sm" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm font-bold text-slate-950">{title}</strong>
        <Sparkles size={16} aria-hidden="true" className="text-amber-600" />
      </div>
      <div className="flex h-28 items-end gap-2" role="img" aria-label={`${title}: ${values.map((value, index) => `${captions[index] || index + 1}: ${value}`).join(", ")}`}>
        {values.map((value, index) => (
          <div key={`${captions[index] || index}-${index}`} className="grid flex-1 items-end gap-1">
            <span className="text-center text-[10px] font-bold text-slate-600">{value}</span>
            <div
              className="w-full rounded-t-lg bg-amber-600 transition-all duration-control"
              style={{ height: `${Math.max(6, Math.round((value / max) * 76))}px` }}
              data-testid={`${testId || "chart"}-bar-${index}`}
            />
            <span className="truncate text-center text-[10px] text-slate-500">{captions[index] || index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StateBadge({ state }: { state: string }) {
  const tone = state === "COMPLETED" || state === "SENT"
    ? "bg-emerald-100 text-emerald-600"
    : state === "FAILED" || state === "DELIVERY_FAILED"
      ? "bg-red-100 text-red-600"
      : state === "WAITING_SIGNATURE" || state === "SIGNED_CONFIRMED"
        ? "bg-amber-100 text-amber-600"
        : "bg-blue-50 text-blue-700";
  return <span className={`${schoolTw.badge} ${tone}`}>{state.replaceAll("_", " ")}</span>;
}

export function CourseCard({ course, classInfo, onOpen, onEnroll }: {
  course: Course; classInfo?: string | null; onOpen?: () => void; onEnroll?: () => void;
}) {
  return (
    <article className={schoolTw.card} data-testid={`course-card-${course.id}`}>
      <div className="grid h-36 place-items-center overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-amber-100 via-blue-50 to-slate-100">
        {course.imageUrl ? (
          <img src={course.imageUrl} alt={`Foto do curso ${course.name}`} className="size-full object-cover" />
        ) : (
          <span className="grid place-items-center gap-1 text-amber-600">
            <Music2 size={34} aria-hidden="true" />
            <small className="font-bold">{course.level || "Curso"}</small>
          </span>
        )}
      </div>
      <div className="grid gap-1">
        <h3 className="m-0 text-base font-extrabold text-slate-950">{course.name}</h3>
        <p className="m-0 text-sm leading-snug text-slate-600">{course.summary || "Detalhes e materiais deste curso ficam disponíveis na aula."}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {course.level ? <span className={schoolTw.chip}>{course.level}</span> : null}
        {course.durationLabel ? <span className={schoolTw.chip}><Clock3 size={13} aria-hidden="true" /> {course.durationLabel}</span> : null}
        {classInfo ? <span className={schoolTw.chip}><CalendarDays size={13} aria-hidden="true" /> {classInfo}</span> : null}
        <span className={schoolTw.chip}>{money(course.tuitionAmountCents)}</span>
      </div>
      {onOpen || onEnroll ? (
        <div className={schoolTw.actions}>
          {onOpen ? <button type="button" className={schoolTw.buttonSoft} onClick={onOpen}>Ver detalhes <ArrowRight size={16} aria-hidden="true" /></button> : null}
          {onEnroll ? <button type="button" className={schoolTw.buttonPrimary} onClick={onEnroll}>Matricular</button> : null}
        </div>
      ) : null}
    </article>
  );
}

/** Modal único: o pai garante no máximo um `activeSheet` por vez. */
export function SchoolSheet({ title, subtitle, onClose, children, footer, testId }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; testId?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={schoolTw.backdrop} onClick={onClose} data-testid={`${testId || "sheet"}-backdrop`}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={schoolTw.panel}
        style={{ isolation: "isolate" }}
        onClick={(event) => event.stopPropagation()}
        data-testid={testId || "sheet"}
      >
        <header className={schoolTw.panelHead}>
          <div className="grid min-w-0 gap-0.5">
            <h2 className="m-0 truncate text-lg font-extrabold text-slate-950">{title}</h2>
            {subtitle ? <p className="m-0 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button type="button" className={schoolTw.buttonSoft} onClick={onClose} aria-label="Fechar janela" data-testid="school-sheet-close">
            <X size={18} aria-hidden="true" /> Fechar
          </button>
        </header>
        <div className={schoolTw.panelBody}>{children}</div>
        {footer ? <footer className={schoolTw.panelFoot}>{footer}</footer> : null}
      </section>
    </div>
  );
}
