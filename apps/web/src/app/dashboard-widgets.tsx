"use client";
import { useEffect, useState } from "react";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets,
  Moon, Sun, Sunrise, Sunset, Wind, ChevronLeft, ChevronRight,
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
    <article className="vx-widget vx-widget-clock" aria-label="Relógio e data de hoje">
      <div className="vx-widget-clock-inner">
        <span className="vx-widget-clock-chip">{isNight ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}{isNight ? "Boa noite" : "Bom dia"}</span>
        <time className="vx-widget-clock-time" dateTime={now.toISOString()}>{hhmmss()}</time>
        <p className="vx-widget-clock-date">{fullDate()}</p>
      </div>
    </article>
  );
}

function WeatherWidget() {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; city?: string; code?: number; temp?: number; min?: number; max?: number; humidity?: number; isDay?: boolean }>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const organization = await fetch("/api/backend/auth/organization", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
        const city = String(organization?.city || "").trim() || "São Paulo";
        const geoKey = "vx:geo:" + city.toLowerCase();
        let geo = JSON.parse(window.localStorage.getItem(geoKey) || "null") as { lat: number; lon: number; name?: string } | null;
        if (!geo) {
          const found = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&countryCode=BR`).then((r) => r.json());
          const first = found?.results?.[0];
          if (first) {
            geo = { lat: first.latitude, lon: first.longitude, name: first.name };
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
  }, []);

  const info = state.status === "ready" ? weatherFor(state.code ?? 0) : null;
  const Icon = info?.Icon ?? CloudSun;
  const night = state.isDay === false;
  return (
    <article className={"vx-widget vx-widget-weather" + (night ? " is-night" : "")} aria-label="Clima agora">
      <div className="vx-widget-weather-head">
        <span className="vx-widget-label">Clima{state.city ? ` · ${state.city}` : ""}</span>
        {night ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      </div>
      {state.status === "loading" ? <p className="vx-widget-weather-loading">Buscando o tempo…</p> : null}
      {state.status === "error" ? (
        <p className="vx-widget-weather-fallback">Não consegui consultar o clima agora.<br />Ajuste a Cidade nos dados da empresa.</p>
      ) : null}
      {state.status === "ready" ? (
        <>
          <div className="vx-widget-weather-main">
            <Icon size={58} strokeWidth={1.7} aria-hidden="true" className="vx-widget-weather-icon" />
            <div className="vx-widget-weather-temp"><b>{state.temp}°</b><span>{info?.label}</span></div>
          </div>
          <div className="vx-widget-weather-meta">
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
    <article className="vx-widget vx-widget-calendar" aria-label="Calendário">
      <div className="vx-widget-calendar-head">
        <strong>{monthLabel(year, month)}</strong>
        <div className="vx-widget-calendar-nav">
          <button type="button" aria-label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" aria-label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="vx-widget-calendar-grid" role="grid" aria-label={monthLabel(year, month)}>
        {WEEKDAYS.map((label, index) => <span key={label} className={"vx-widget-calendar-wd" + (isWeekend(index) ? " is-weekend" : "")} role="columnheader">{label}</span>)}
        {cells.map((day, index) => (
          <span
            key={index}
            role="gridcell"
            className={"vx-widget-calendar-day" + (day === null ? " is-empty" : "") + (isToday(day) ? " is-today" : "") + (day !== null && isWeekend(index) ? " is-weekend" : "")}
          >
            {day ?? ""}
          </span>
        ))}
      </div>
      <p className="vx-widget-calendar-today">Hoje é {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
    </article>
  );
}

/** Widgets coloridos da tela inicial: relógio, clima e calendário. */
export function DashboardWidgets() {
  return (
    <section className="vx-widgets" aria-label="Seu dia agora">
      <ClockWidget />
      <WeatherWidget />
      <CalendarWidget />
    </section>
  );
}
