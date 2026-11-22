"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, CheckCircle2, X } from "lucide-react";

const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonTw = "inline-grid size-9 place-items-center rounded-token-sm border border-line bg-surface text-ink shadow-token-sm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const shellTw = "fixed inset-0 z-reminder grid place-items-center p-5";
const backdropTw = "absolute inset-0 bg-overlay backdrop-blur-reminder";
const cardTw = "relative grid w-full max-w-reminder-card gap-4 rounded-reminder-card border border-line bg-surface p-reminder-pad shadow-reminder-card animate-reminder-card";
const headerTw = "flex items-center gap-3.5";
const titleTw = "m-0 font-display text-reminder-title font-extrabold text-ink";
const subtitleTw = "mt-0.5 text-reminder-desc text-ink-secondary";
const badgeTw = "grid size-reminder-icon place-items-center rounded-reminder-icon bg-blue-50 text-blue-600";
const listTw = "m-0 grid list-none gap-2 p-0";
const itemTw = "flex items-start gap-3 rounded-reminder-item border border-line bg-surface-2 p-3";
const itemOverdueTw = "border-red-600 bg-red-100";
const itemIconTw = "mt-0.5 text-blue-600";
const itemIconOverdueTw = "text-red-600";
const itemVariantTw: Record<"normal" | "overdue", string> = {
  normal: itemTw,
  overdue: `${itemTw} ${itemOverdueTw}`,
};
const itemIconVariantTw: Record<"normal" | "overdue", string> = {
  normal: itemIconTw,
  overdue: `${itemIconTw} ${itemIconOverdueTw}`,
};
const itemTitleTw = "block text-reminder-item-title text-ink";
const itemMetaTw = "mt-1 block text-reminder-item-meta text-ink-secondary";
const footerTw = "flex flex-wrap justify-end gap-2";
type Reminder = { fireKey: string; kind: "task" | "event"; title: string; when: string; overdue: boolean; url?: string };
type Settings = { enabled: boolean; minutesBefore: number[]; sound: boolean; push: boolean; mutedWeekdays?: number[]; maxPerDay?: number };
type AgendaReminders = Record<string, { enabled: boolean; minutesBefore: number[] }>;

const FIRED_KEY = "vx:reminders:fired";
const SNOOZE_KEY = "vx:reminders:snooze-until";
const readJson = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(window.localStorage.getItem(key) || "") as T; } catch { return fallback; }
};
const writeJson = (key: string, value: unknown) => { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } };
const minutesUntil = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 60000);
const formatWhen = (iso: string) => {
  const diff = minutesUntil(iso);
  const at = new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  if (diff < 0) return `atrasada há ${Math.abs(diff)} min · ${at}`;
  if (diff < 1) return "agora mesmo";
  if (diff < 60) return `em ${diff} min · ${at}`;
  if (diff < 1440) return `em ${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, "0")} · ${at}`;
  return at;
};

const beep = () => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext; if (!Ctx) return;
    const ctx = new Ctx() as AudioContext;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; g.gain.setValueAtTime(0.18, ctx.currentTime);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(659.25, ctx.currentTime + 0.16);
    o.frequency.setValueAtTime(880, ctx.currentTime + 0.32);
    o.start(); o.stop(ctx.currentTime + 0.5);
    o.onended = () => { void ctx.close(); };
  } catch { /* sem áudio */ }
};

/** Lembretes internos: invade a tela para tarefas e compromissos prestes a começar (ou atrasados). */
export function ReminderCenter() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [queue, setQueue] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const collect = useCallback(async () => {
    try {
      const s = await fetch("/api/backend/reminders/settings", { cache: "no-store" }).then(r => r.ok ? r.json() : null) as Settings | null;
      setSettings(s);
      if (!s || s.enabled === false) return;
      if (Array.isArray(s.mutedWeekdays) && s.mutedWeekdays.includes(new Date().getDay())) return;
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const now = new Date();
      const budgetKey = `vx:reminders:budget:${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const budgetSpent = Number(window.localStorage.getItem(budgetKey) || 0);
      const maxPerDay = typeof s.maxPerDay === "number" ? s.maxPerDay : 15;
      if (budgetSpent >= maxPerDay) return;
      const room = Math.max(1, maxPerDay - budgetSpent);
      const lookahead = Math.max(...(s.minutesBefore || [15, 60]));
      const fired = readJson<Record<string, number>>(FIRED_KEY, {});
      const snoozeUntil = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
      if (Date.now() < snoozeUntil) return;
      const reminders: Reminder[] = [];
      const due = await fetch("/api/backend/reminders/due?withinMinutes=" + lookahead, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
      for (const task of (due?.tasks || [])) {
        reminders.push({ fireKey: `task:${task.id}`, kind: "task", title: task.title, when: task.dueAt, overdue: new Date(task.dueAt).getTime() < Date.now() });
      }
      const agendas = await fetch("/api/backend/reminders/agendas", { cache: "no-store" }).then(r => r.ok ? r.json() : null) as { agendas?: AgendaReminders } | null;
      const agendaMap: AgendaReminders = agendas?.agendas || {};
      try {
        const accounts = await fetch("/api/backend/integrations/google/calendar/accounts", { cache: "no-store" }).then(r => r.ok ? r.json() : []);
        for (const account of (Array.isArray(accounts) ? accounts : []).slice(0, 2)) {
          const calendars = await fetch("/api/backend/integrations/google/calendar/" + encodeURIComponent(account.id) + "/calendars", { cache: "no-store" }).then(r => r.json()).catch(() => ({ items: [] }));
          for (const cal of (calendars.items || []).slice(0, 3)) {
            const cfg = agendaMap[account.id + ":" + cal.id];
            if (cfg && cfg.enabled === false) continue; // lembrete desligado nesta agenda
            const agendaLookahead = Math.max(...(cfg?.minutesBefore || s.minutesBefore || [15, 60]));
            const params = new URLSearchParams({ calendarId: cal.id, timeMin: new Date(Date.now() - 30 * 60000).toISOString(), timeMax: new Date(Date.now() + agendaLookahead * 60000).toISOString() });
            const events = await fetch("/api/backend/integrations/google/calendar/" + encodeURIComponent(account.id) + "/events?" + params.toString(), { cache: "no-store" }).then(r => r.ok ? r.json() : null).catch(() => null);
            for (const event of (events?.items || [])) {
              const start = new Date(event.start?.dateTime || event.start?.date || Date.now());
              reminders.push({ fireKey: `event:${event.id || start.toISOString()}`, kind: "event", title: event.summary || "Compromisso", when: start.toISOString(), overdue: false });
            }
          }
        }
      } catch { /* sem agenda conectada — só tarefas */ }
      const fresh = reminders.filter(item => {
        const last = fired[item.fireKey] || 0;
        return Date.now() - last > 30 * 60000; // repete no máx. a cada 30 min por item
      });
      if (!fresh.length) return;
      const next = [...fresh].sort((a, b) => +new Date(a.when) - +new Date(b.when)).slice(0, Math.min(5, room));
      setQueue(next);
      setOpen(true);
      for (const item of next) fired[item.fireKey] = Date.now();
      writeJson(FIRED_KEY, fired);
      try { window.localStorage.setItem(budgetKey, String(budgetSpent + next.length)); } catch { /* ignore */ }
      if (s.sound !== false) beep();
    } catch { /* silencioso — tenta de novo no próximo ciclo */ }
  }, []);

  useEffect(() => {
    void collect();
    pollRef.current = setInterval(() => { void collect(); }, 60000);
    const onFocus = () => { void collect(); };
    const onVisibility = () => { if (!document.hidden) void collect(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [collect]);

  const dismissAll = () => setOpen(false);
  const snoozeAll = () => {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + 15 * 60000));
    setOpen(false);
  };
  const openModule = (name: string) => {
    window.dispatchEvent(new CustomEvent("vexora:open-module", { detail: name }));
    setOpen(false);
  };

  if (!open || !queue.length) return null;
  return (
    <div className={shellTw} role="alertdialog" aria-modal="true" aria-label="Lembrete">
      <div className={backdropTw} onClick={dismissAll} aria-hidden="true" />
      <section className={cardTw}>
        <header className={headerTw}>
          <span className={badgeTw} aria-hidden="true"><Bell size={26} /></span>
          <div>
            <h2 className={titleTw}>{queue.length === 1 ? "Lembrete" : `${queue.length} lembretes`}</h2>
            <p className={subtitleTw}>{settings?.minutesBefore?.length ? `Avisos: ${settings.minutesBefore.join(", ")} min antes` : "Nova tarefa ou compromisso prestes a começar"}</p>
          </div>
          <button type="button" className={iconButtonTw} aria-label="Fechar lembretes" onClick={dismissAll}><X size={20} aria-hidden="true" /></button>
        </header>
        <ul className={listTw}>
          {queue.map(item => (
            <li key={item.fireKey} className={itemVariantTw[item.overdue ? "overdue" : "normal"]}>
              {item.kind === "task" ? <CalendarClock size={18} aria-hidden="true" className={itemIconVariantTw[item.overdue ? "overdue" : "normal"]} /> : <Bell size={18} aria-hidden="true" className={itemIconVariantTw[item.overdue ? "overdue" : "normal"]} />}
              <div>
                <strong className={itemTitleTw}>{item.title}</strong>
                <small className={itemMetaTw}>{item.kind === "task" ? "Tarefa" : "Compromisso"} · {formatWhen(item.when)}</small>
              </div>
            </li>
          ))}
        </ul>
        <footer className={footerTw}>
          <button type="button" className={secondaryTw} onClick={snoozeAll}>Adiar 15 min</button>
          <button type="button" className={secondaryTw} onClick={() => openModule(queue[0]?.kind === "event" ? "Agenda" : "Tarefas")}>Abrir {queue[0]?.kind === "event" ? "agenda" : "tarefas"}</button>
          <button type="button" className={primaryTw} onClick={dismissAll}><CheckCircle2 size={15} aria-hidden="true" /> Entendi</button>
        </footer>
      </section>
    </div>
  );
}
