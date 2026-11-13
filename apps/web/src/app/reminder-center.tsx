"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, CheckCircle2, X } from "lucide-react";

type Reminder = { fireKey: string; kind: "task" | "event"; title: string; when: string; overdue: boolean; url?: string };
type Settings = { enabled: boolean; minutesBefore: number[]; sound: boolean; push: boolean };

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
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const collect = useCallback(async () => {
    try {
      const s = await fetch("/api/backend/reminders/settings", { cache: "no-store" }).then(r => r.ok ? r.json() : null) as Settings | null;
      setSettings(s);
      if (!s || s.enabled === false) return;
      const lookahead = Math.max(...(s.minutesBefore || [15, 60]));
      const fired = readJson<Record<string, number>>(FIRED_KEY, {});
      const snoozeUntil = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
      if (Date.now() < snoozeUntil) return;
      const reminders: Reminder[] = [];
      const due = await fetch("/api/backend/reminders/due?withinMinutes=" + lookahead, { cache: "no-store" }).then(r => r.ok ? r.json() : null);
      for (const task of (due?.tasks || [])) {
        reminders.push({ fireKey: `task:${task.id}`, kind: "task", title: task.title, when: task.dueAt, overdue: new Date(task.dueAt).getTime() < Date.now() });
      }
      try {
        const accounts = await fetch("/api/backend/integrations/google/calendar/accounts", { cache: "no-store" }).then(r => r.ok ? r.json() : []);
        for (const account of (Array.isArray(accounts) ? accounts : []).slice(0, 2)) {
          const calendars = await fetch("/api/backend/integrations/google/calendar/" + encodeURIComponent(account.id) + "/calendars", { cache: "no-store" }).then(r => r.json()).catch(() => ({ items: [] }));
          for (const cal of (calendars.items || []).slice(0, 3)) {
            const params = new URLSearchParams({ calendarId: cal.id, timeMin: new Date(Date.now() - 30 * 60000).toISOString(), timeMax: new Date(Date.now() + lookahead * 60000).toISOString() });
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
      const next = [...fresh].sort((a, b) => +new Date(a.when) - +new Date(b.when)).slice(0, 5);
      setQueue(next);
      setOpen(true);
      for (const item of next) fired[item.fireKey] = Date.now();
      writeJson(FIRED_KEY, fired);
      if (s.sound !== false) beep();
    } catch { /* silencioso — tenta de novo no próximo ciclo */ } finally { setLoading(false); }
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
    <div className="reminder-center" role="alertdialog" aria-modal="true" aria-label="Lembrete">
      <div className="reminder-center-backdrop" onClick={dismissAll} aria-hidden="true" />
      <section className="reminder-center-card">
        <header>
          <span className="reminder-center-icon" aria-hidden="true"><Bell size={26} /></span>
          <div>
            <h2>{queue.length === 1 ? "Lembrete" : `${queue.length} lembretes`}</h2>
            <p>{settings?.minutesBefore?.length ? `Avisos: ${settings.minutesBefore.join(", ")} min antes` : "Nova tarefa ou compromisso prestes a começar"}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar lembretes" onClick={dismissAll}><X size={20} aria-hidden="true" /></button>
        </header>
        <ul className="reminder-center-list">
          {queue.map(item => (
            <li key={item.fireKey} className={"reminder-center-item" + (item.overdue ? " is-overdue" : "")}>
              {item.kind === "task" ? <CalendarClock size={18} aria-hidden="true" className="reminder-center-item-icon" /> : <Bell size={18} aria-hidden="true" className="reminder-center-item-icon" />}
              <div>
                <strong>{item.title}</strong>
                <small>{item.kind === "task" ? "Tarefa" : "Compromisso"} · {formatWhen(item.when)}</small>
              </div>
            </li>
          ))}
        </ul>
        <footer>
          <button type="button" className="secondary-button" onClick={snoozeAll}>Adiar 15 min</button>
          <button type="button" className="secondary-button" onClick={() => openModule(queue[0]?.kind === "event" ? "Agenda" : "Tarefas")}>Abrir {queue[0]?.kind === "event" ? "agenda" : "tarefas"}</button>
          <button type="button" className="primary-button" onClick={dismissAll}><CheckCircle2 size={15} aria-hidden="true" /> Entendi</button>
        </footer>
      </section>
    </div>
  );
}
