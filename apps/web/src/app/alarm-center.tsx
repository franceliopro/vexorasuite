"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlarmClock, Check, TimerReset } from "lucide-react";

type Alarm = { id: string; title: string; time: string; date?: string; weekdays?: number[]; enabled: boolean };
const FIRED_KEY = "vx:alarms:fired";
const SNOOZED_KEY = "vx:alarms:snoozed";
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const readJson = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(window.localStorage.getItem(key) || "") as T; } catch { return fallback; }
};
const writeJson = (key: string, value: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};
const pad = (n: number) => String(n).padStart(2, "0");
const ymdLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmmLocal = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const describe = (alarm: Alarm) => {
  if (alarm.date) {
    const [year = 2000, month = 1, day = 1] = alarm.date.split("-").map(Number);
    const when = new Date(year, month - 1, day);
    return `Alarme de uma vez · ${when.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}`;
  }
  return `Alarme recorrente · toda ${(alarm.weekdays || []).map((day) => WEEKDAYS[day]).join(", ")}`;
};
const speak = (text: string) => {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance("Lembrete: " + text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.98;
    synth.cancel();
    synth.speak(utterance);
  } catch { /* voz não disponível */ }
};
const siren = (context: AudioContext) => {
  const t = context.currentTime;
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.55, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
  const osc = context.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(740, t);
  osc.frequency.linearRampToValueAtTime(988, t + 0.28);
  osc.frequency.linearRampToValueAtTime(740, t + 0.58);
  osc.frequency.linearRampToValueAtTime(988, t + 0.86);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + 1.2);
};

/** Alarmes pessoais: acordo no horário exato, com toque e nome do compromisso. */
export function AlarmCenter() {
  const [ringing, setRinging] = useState<Alarm[]>([]);
  const audioRef = useRef<AudioContext | null>(null);

  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/backend/reminders/alarms", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const list: Alarm[] = Array.isArray(data.alarms) ? data.alarms : [];
      const now = new Date();
      const hhmm = hhmmLocal(now);
      const ymd = ymdLocal(now);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const stored = readJson<Record<string, number>>(FIRED_KEY, {});
      const snoozed = readJson<Record<string, number>>(SNOOZED_KEY, {});
      const due: Alarm[] = [];
      for (const alarm of list) {
        if (!alarm || alarm.enabled === false || alarm.time !== hhmm) continue;
        if (alarm.date && alarm.date !== ymd) continue;
        if (alarm.weekdays && !alarm.weekdays.includes(now.getDay())) continue;
        if ((snoozed[alarm.id] || 0) > Date.now()) continue;
        if ((stored[`${alarm.id}:${ymd}`] || 0) >= startOfToday) continue;
        due.push(alarm);
      }
      if (!due.length) return;
      const fired = { ...stored };
      for (const alarm of due) fired[`${alarm.id}:${ymd}`] = Date.now();
      writeJson(FIRED_KEY, fired);
      setRinging((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...due.filter((item) => !seen.has(item.id))];
      });
      for (const alarm of due) speak(alarm.title);
    } catch { /* silencioso — tenta de novo no próximo ciclo */ }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => { void check(); }, 15000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  useEffect(() => {
    if (!ringing.length) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const context = audioRef.current ?? (audioRef.current = new Ctx());
      const play = () => {
        try { siren(context); } catch { /* ignore */ }
      };
      play();
      const timer = window.setInterval(play, 1700);
      const speechTimer = window.setInterval(() => { for (const alarm of ringing) speak(alarm.title); }, 14000);
      return () => {
        window.clearInterval(timer);
        window.clearInterval(speechTimer);
      };
    } catch { /* sem áudio */ }
  }, [ringing]);

  useEffect(() => () => {
    if (audioRef.current) {
      void audioRef.current.close().catch(() => undefined);
      audioRef.current = null;
    }
  }, []);

  function dismiss(alarm: Alarm) {
    setRinging((current) => current.filter((item) => item.id !== alarm.id));
    if (alarm.date) {
      // Alarme de uma vez: desativa no backend para não ficar pendurado.
      void (async () => {
        try {
          const response = await fetch("/api/backend/reminders/alarms", { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          const list: Alarm[] = Array.isArray(data.alarms) ? data.alarms : [];
          await fetch("/api/backend/reminders/alarms", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ alarms: list.map((item) => (item.id === alarm.id ? { ...item, enabled: false } : item)) }),
          });
        } catch { /* manter como está */ }
      })();
    }
  }

  function snooze(alarm: Alarm) {
    const snoozed = readJson<Record<string, number>>(SNOOZED_KEY, {});
    snoozed[alarm.id] = Date.now() + 5 * 60 * 1000;
    writeJson(SNOOZED_KEY, snoozed);
    const fired = readJson<Record<string, number>>(FIRED_KEY, {});
    delete fired[`${alarm.id}:${ymdLocal(new Date())}`];
    writeJson(FIRED_KEY, fired);
    setRinging((current) => current.filter((item) => item.id !== alarm.id));
  }

  if (!ringing.length) return null;
  return (
    <div className="alarm-overlay" role="alertdialog" aria-modal="true" aria-label={ringing.length === 1 ? "Alarme tocando" : "Alarmes tocando"}>
      <section className="alarm-card">
        <span className="alarm-card-icon" aria-hidden="true"><AlarmClock size={56} strokeWidth={1.9} /></span>
        <p className="alarm-eyebrow">{ringing.length === 1 ? "Alarme" : `${ringing.length} alarmes`} · {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
        <ul className="alarm-firing-list">
          {ringing.map((alarm) => (
            <li key={alarm.id} className="alarm-firing-item">
              <h1>{alarm.title}</h1>
              <p>{describe(alarm)}</p>
              <div className="alarm-actions">
                <button type="button" className="secondary-button alarm-snooze" onClick={() => snooze(alarm)}><TimerReset size={17} aria-hidden="true" /> Adiar 5 min</button>
                <button type="button" className="primary-button alarm-stop" onClick={() => dismiss(alarm)}><Check size={18} aria-hidden="true" /> Parar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
