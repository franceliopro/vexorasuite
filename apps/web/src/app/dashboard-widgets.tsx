"use client";
import { useEffect, useState } from "react";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets,
  Moon, Sun, Sunrise, Sunset, Wind, ChevronLeft, ChevronRight, MapPin,
} from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const fullDate = () => {
  const now = new Date();
  return `Hoje é ${now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
};
const pad = (n: number) => String(n).padStart(2, "0");
const hhmmss = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const monthLabel = (year: number, month: number) =>
  `${MONTH_NAMES[month]!.charAt(0).toUpperCase()}${MONTH_NAMES[month]!.slice(1)} de ${year}`;

const weatherFor = (code: number) => {
  if (code === 0) return { label: "Céu limpo", Icon: Sun };
  if (code <= 2) return { label: "Parcialmente nublado", Icon: CloudSun };
  if (code === 3) return { label: "Nublado", Icon: Cloud };
  if (code === 45 || code === 48) return { label: "Neblina", Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Chuvisco", Icon: CloudDrizzle };
  if (code >= 61 && code <= 67) return { label: "Chuva", Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: "Neve", Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: "Pancadas de chuva", Icon: CloudRain };
  if (code >= 95) return { label: "Trovoada", Icon: CloudLightning };
  return { label: "Tempo instável", Icon: CloudSun };
};

function ClockWidget() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const isNight = now.getHours() < 6 || now.getHours() >= 18;
  return (
    <article className="ov-widget ov-widget-clock" aria-label="Relógio e data de hoje">
      <div className="ov-widget-clock-inner">
        <span className="ov-widget-clock-chip">{isNight ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}{isNight ? "Boa noite" : "Bom dia"}</span>
        <time className="ov-widget-clock-time" dateTime={now.toISOString()}>{hhmmss()}</time>
        <p className="ov-widget-clock-date">{fullDate()}</p>
      </div>
    </article>
  );
}

function WeatherWidget() {
  const [configuredCity, setConfiguredCity] = useState<string | null>(() => { try { return window.localStorage.getItem("vx:weather-city"); } catch { return null; } });
  const [editing, setEditing] = useState(false);
  const [draftCity, setDraftCity] = useState(configuredCity || "");
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; city?: string; code?: number; temp?: number; min?: number; max?: number; humidity?: number; isDay?: boolean }>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let city = configuredCity || "";
        if (!city) {
          const organization = await fetch("/api/backend/auth/organization", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
          city = String(organization?.city || "").trim();
        }
        if (!city) city = "São Paulo";
        const geoKey = "vx:geo:" + city.toLowerCase();
        let geo = JSON.parse(window.localStorage.getItem(geoKey) || "null") as { lat: number; lon: number; name?: string } | null;
        if (!geo) {
          const parts = city.split(",");
          const name = (parts[0] || "").trim();
          const stateHint = (parts[1] || "").trim().toUpperCase();
          const found = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=pt&countryCode=BR`).then((r) => r.json());
          let first = found?.results?.[0];
          if (stateHint && found?.results?.length) {
            const match = found.results.find((item: { admin1?: string }) => {
              const admin = String(item.admin1 || "").toUpperCase();
              return admin === stateHint || admin.startsWith(stateHint) || admin.slice(0, 2).toUpperCase() === stateHint.slice(0, 2);
            });
            if (match) first = match;
          }
          if (first) {
            const shortState = String(first.admin1 || "").trim();
            geo = { lat: first.latitude, lon: first.longitude, name: first.name + (shortState ? " · " + shortState : "") };
            try { window.localStorage.setItem(geoKey, JSON.stringify(geo)); } catch { /* ignore */ }
          }
        }
        if (!geo) throw new Error("cidade não encontrada");
        const forecast = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`).then((r) => r.json());
        if (cancelled) return;
        if (!forecast?.current) throw new Error("previsão indisponível");
        setState({
          status: "ready",
          city: geo.name || city,
          code: Number(forecast.current.weather_code ?? 0),
          temp: Math.round(Number(forecast.current.temperature_2m ?? 0)),
          min: Math.round(Number(forecast.daily?.temperature_2m_min?.[0] ?? 0)),
          max: Math.round(Number(forecast.daily?.temperature_2m_max?.[0] ?? 0)),
          humidity: Math.round(Number(forecast.current.relative_humidity_2m ?? 0)),
          isDay: Number(forecast.current.is_day ?? 1) === 1,
        });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [configuredCity]);

  const saveCity = () => {
    const value = draftCity.trim();
    if (!value) return;
    try { window.localStorage.setItem("vx:weather-city", value); } catch { /* ignore */ }
    setConfiguredCity(value);
    setEditing(false);
  };

  const info = state.status === "ready" ? weatherFor(state.code ?? 0) : null;
  const Icon = info?.Icon ?? CloudSun;
  const night = state.isDay === false;
  return (
    <article className={"ov-widget ov-widget-weather" + (night ? " is-night" : "")} aria-label="Clima agora">
      <div className="ov-widget-weather-head">
        <span className="ov-widget-label">Clima{state.city ? ` · ${state.city}` : ""}</span>
        <span className="ov-widget-weather-head-actions">
          <button type="button" className="ov-widget-weather-config" onClick={() => { setDraftCity(configuredCity || state.city || ""); setEditing(v => !v); }} aria-label="Definir local do clima" title="Definir local do clima"><MapPin size={14} aria-hidden="true" /></button>
          {night ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        </span>
      </div>
      {editing ? (
        <form className="ov-widget-weather-config-form" onSubmit={(event) => { event.preventDefault(); saveCity(); }}>
          <input autoFocus value={draftCity} onChange={(event) => setDraftCity(event.target.value)} aria-label="Cidade para o clima" placeholder="Ex.: Rondonópolis, MT" />
          <button type="submit" className="ov-widget-weather-config-save">Salvar</button>
        </form>
      ) : null}
      {state.status === "loading" ? <p className="ov-widget-weather-loading">Buscando o tempo…</p> : null}
      {state.status === "error" ? (
        <p className="ov-widget-weather-fallback">Não consegui consultar o clima agora.<br />Toque no alfinete para definir a sua cidade.</p>
      ) : null}
      {state.status === "ready" ? (
        <>
          <div className="ov-widget-weather-main">
            <Icon size={58} strokeWidth={1.7} aria-hidden="true" className="ov-widget-weather-icon" />
            <div className="ov-widget-weather-temp"><b>{state.temp}°</b><span>{info?.label}</span></div>
          </div>
          <div className="ov-widget-weather-meta">
            <span><Sunrise size={13} aria-hidden="true" /> Máx. {state.max}°</span>
            <span><Sunset size={13} aria-hidden="true" /> Mín. {state.min}°</span>
            <span><Droplets size={13} aria-hidden="true" /> {state.humidity}%</span>
            <span><Wind size={13} aria-hidden="true" /> brisa</span>
          </div>
        </>
      ) : null}
    </article>
  );
}

function CalendarWidget() {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let index = 0; index < firstWeekday; index++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  const isToday = (day: number | null) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isWeekend = (index: number) => index % 7 === 0 || index % 7 === 6;
  return (
    <article className="ov-widget ov-widget-calendar" aria-label="Calendário">
      <div className="ov-widget-calendar-head">
        <strong>{monthLabel(year, month)}</strong>
        <div className="ov-widget-calendar-nav">
          <button type="button" aria-label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" aria-label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="ov-widget-calendar-grid" role="grid" aria-label={monthLabel(year, month)}>
        {WEEKDAYS.map((label, index) => <span key={label} className={"ov-widget-calendar-wd" + (isWeekend(index) ? " is-weekend" : "")} role="columnheader">{label}</span>)}
        {cells.map((day, index) => (
          <span
            key={index}
            role="gridcell"
            className={"ov-widget-calendar-day" + (day === null ? " is-empty" : "") + (isToday(day) ? " is-today" : "") + (day !== null && isWeekend(index) ? " is-weekend" : "")}
          >
            {day ?? ""}
          </span>
        ))}
      </div>
      <p className="ov-widget-calendar-today">Hoje é {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
    </article>
  );
}

/** Widgets coloridos da tela inicial: relógio, clima e calendário. */
export function DashboardWidgets() {
  return (
    <section className="ov-widgets" aria-label="Seu dia agora">
      <ClockWidget />
      <WeatherWidget />
      <CalendarWidget />
    </section>
  );
}
