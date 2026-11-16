"use client";
import { useEffect, useState } from "react";
import { AlarmClock, BellRing, Plus, Trash2 } from "lucide-react";

type Alarm = { id: string; title: string; time: string; date?: string; weekdays?: number[]; enabled: boolean };
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const ymd = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const describe = (alarm: Alarm) => {
  if (alarm.date) {
    const [year = 2000, month = 1, day = 1] = alarm.date.split("-").map(Number);
    const when = new Date(year, month - 1, day);
    return `Só uma vez · ${when.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`;
  }
  const days = (alarm.weekdays || []).map((day) => WEEKDAYS[day]).join(", ");
  return `Toda semana · ${days}`;
};

/** Alarmes pessoais: despertam no navegador aberto com toque e nome do compromisso. */
export function PersonalAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("16:00");
  const [mode, setMode] = useState<"once" | "weekdays">("weekdays");
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); });
  const [weekdays, setWeekdays] = useState<number[]>([4]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetch("/api/backend/reminders/alarms", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw Error(data.message || "Não foi possível consultar os alarmes.");
        setAlarms(Array.isArray(data.alarms) ? data.alarms : []);
        setLoaded(true);
      })
      .catch((error) => {
        setNotice(error instanceof Error ? error.message : "Não foi possível consultar os alarmes.");
        setLoaded(true);
      });
  }, []);

  async function save(next: Alarm[]) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/backend/reminders/alarms", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alarms: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.message || "Não foi possível salvar os alarmes.");
      setAlarms(Array.isArray(data.alarms) ? data.alarms : next);
      setNotice("Alarmes salvos.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha de conexão.");
    } finally {
      setBusy(false);
    }
  }

  function addAlarm() {
    const name = title.trim();
    if (name.length < 2) {
      setNotice("Dê um nome ao alarme (ex.: Reunião semanal).");
      return;
    }
    if (mode === "weekdays" && !weekdays.length) {
      setNotice("Marque ao menos um dia da semana.");
      return;
    }
    const alarm: Alarm = {
      id: uid(),
      title: name,
      time,
      enabled: true,
      ...(mode === "once" ? { date } : { weekdays: [...weekdays].sort((a, b) => a - b) }),
    };
    setTitle("");
    void save([...alarms, alarm]);
  }

  function toggleWeekday(day: number) {
    setWeekdays((value) => (value.includes(day) ? value.filter((item) => item !== day) : [...value, day]));
  }

  return (
    <details className="content-card settings-card">
      <summary><span className="settings-card-summary-icon"><AlarmClock size={16} aria-hidden="true" /></span> Alarmes pessoais</summary>
      <p>Desperta na hora exata, com o nome do compromisso em voz alta (quando o navegador permitir) e toque contínuo. Funciona no navegador/PWA aberto.</p>

      <form className="alarms-form" onSubmit={(event) => { event.preventDefault(); addAlarm(); }}>
        <div className="alarms-form-grid">
          <label className="alarms-form-wide">Nome do alarme
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Ex.: Reunião semanal com o cliente" autoComplete="off" />
          </label>
          <label>Horário
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </label>
          <label>Quando
            <select value={mode} onChange={(event) => setMode(event.target.value as "once" | "weekdays")}>
              <option value="weekdays">Repete toda semana</option>
              <option value="once">Só uma vez (data)</option>
            </select>
          </label>
          {mode === "once" ? (
            <label>Data
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
          ) : (
            <fieldset className="alarms-weekdays">
              <legend>Dias da semana</legend>
              <div>
                {WEEKDAYS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    className={"alarms-weekday" + (weekdays.includes(day) ? " is-active" : "")}
                    aria-pressed={weekdays.includes(day)}
                    onClick={() => toggleWeekday(day)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        <button className="primary-button" disabled={busy || !loaded}>
          <Plus size={15} aria-hidden="true" /> Criar alarme
        </button>
      </form>

      {notice ? <p role="status">{notice}</p> : null}

      {loaded && alarms.length ? (
        <ul className="alarms-list" aria-label="Alarmes configurados">
          {alarms.map((alarm) => (
            <li key={alarm.id} className={"alarms-item" + (alarm.enabled ? "" : " is-off")}>
              <button
                type="button"
                className="alarms-toggle"
                role="switch"
                aria-checked={alarm.enabled}
                aria-label={(alarm.enabled ? "Desativar" : "Ativar") + " o alarme " + alarm.title}
                onClick={() => void save(alarms.map((item) => (item.id === alarm.id ? { ...item, enabled: !item.enabled } : item)))}
              >
                <BellRing size={17} aria-hidden="true" />
              </button>
              <div className="alarms-item-copy">
                <strong>{alarm.title}</strong>
                <small><b>{alarm.time}</b> · {describe(alarm)}</small>
              </div>
              <button
                type="button"
                className="icon-button alarms-remove"
                aria-label={"Excluir o alarme " + alarm.title}
                onClick={() => void save(alarms.filter((item) => item.id !== alarm.id))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {loaded && !alarms.length ? <p className="alarms-empty">Nenhum alarme ainda. Crie o primeiro acima — por exemplo: toda quinta às 16h, “Check-in com a equipe”.</p> : null}
    </details>
  );
}
