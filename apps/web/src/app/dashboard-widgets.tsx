"use client";
import { useEffect, useState } from "react";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets,
  Moon, Sun, Sunrise, Sunset, Wind, ChevronLeft, ChevronRight, MapPin, Palette,
} from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/* Estados visuais em literais completas: a classe aplicada nunca é montada por interpolação. */
const weatherCardBaseTw = "grid min-h-24 content-start gap-3 rounded-xl border border-white/40 p-5 text-slate-50";
const weatherCardTw: Record<string, string> = {
  clear: "bg-linear-to-br from-sky-500 via-blue-500 to-indigo-600",
  cloudy: "bg-linear-to-br from-slate-400 via-slate-500 to-blue-500",
  rain: "bg-linear-to-br from-cyan-500 via-blue-600 to-blue-700",
  storm: "bg-linear-to-br from-violet-500 via-purple-600 to-indigo-700",
  night: "bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-800",
};
/* Substitui o gradiente do clima quando a pessoa escolhe outro fundo. "auto"
   mantém o gradiente por condição; os demais são literais completas. */
const weatherBackgroundTw: Record<string, string> = {
  auto: "",
  sky: "bg-linear-to-br from-sky-400 to-blue-600",
  sunset: "bg-linear-to-br from-amber-400 to-rose-500",
  ocean: "bg-linear-to-br from-cyan-500 to-cyan-700",
  violet: "bg-linear-to-br from-violet-500 to-fuchsia-600",
};
const WEATHER_BACKGROUNDS = ["auto", "sky", "sunset", "ocean", "violet"] as const;
const weatherBackgroundLabel: Record<string, string> = {
  auto: "Automático",
  sky: "Céu",
  sunset: "Pôr do sol",
  ocean: "Oceano",
  violet: "Violeta",
};
const weatherAccentTw: Record<string, string> = {
  clear: "text-amber-300",
  cloudy: "text-slate-100",
  rain: "text-cyan-100",
  storm: "text-violet-100",
  night: "text-indigo-100",
};
const weatherSurface = (code: number | undefined, isDay: boolean | undefined) => {
  if (isDay === false) return "night";
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "cloudy";
  if ((code ?? 0) >= 95) return "storm";
  if ((code ?? 0) >= 51) return "rain";
  return "cloudy";
};
const weekdayTw: Record<string, string> = {
  weekend: "border-b border-purple-200 pb-1 text-xs font-bold uppercase text-purple-700 dark:border-slate-700 dark:text-purple-300",
  weekday: "border-b border-purple-200 pb-1 text-xs font-bold uppercase text-slate-600 dark:border-slate-700 dark:text-slate-300",
};
const calendarCellTw: Record<string, string> = {
  blank: "invisible",
  today: "border-b border-purple-100 bg-blue-600 font-bold text-slate-50 dark:border-slate-800",
  weekend: "border-b border-purple-100 text-purple-700 dark:border-slate-800 dark:text-purple-300",
  weekday: "border-b border-purple-100 text-slate-700 dark:border-slate-800 dark:text-slate-200",
};
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
    <article className="col-span-3 grid content-center justify-items-center gap-2 rounded-xl border border-gray-200 bg-linear-to-br from-blue-50 to-blue-100 p-5 text-center max-md:col-span-12" aria-label="Relógio e data de hoje">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-slate-50">{isNight ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}{isNight ? "Boa noite" : "Bom dia"}</span>
      <time className="text-3xl font-semibold tabular-nums text-blue-700 sm:text-4xl" dateTime={now.toISOString()}>{hhmmss()}</time>
      <p className="text-sm text-slate-600">Horário local</p>
    </article>
  );
}

function WeatherWidget() {
  const [configuredCity, setConfiguredCity] = useState<string | null>(() => { try { return window.localStorage.getItem("vx:weather-city"); } catch { return null; } });
  const [background, setBackground] = useState<string>(() => { try { const value = window.localStorage.getItem("vx:weather-bg") || "auto"; return WEATHER_BACKGROUNDS.includes(value as (typeof WEATHER_BACKGROUNDS)[number]) ? value : "auto"; } catch { return "auto"; } });
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
  const surface = weatherSurface(state.code, state.isDay);
  const backgroundLabel = weatherBackgroundLabel[background] || weatherBackgroundLabel.auto;
  const nextBackground = () => {
    const index = WEATHER_BACKGROUNDS.indexOf(background as (typeof WEATHER_BACKGROUNDS)[number]);
    const next = WEATHER_BACKGROUNDS[(index + 1) % WEATHER_BACKGROUNDS.length]!;
    try { window.localStorage.setItem("vx:weather-bg", next); } catch { /* ignore */ }
    setBackground(next);
  };
  return (
    <article className={weatherCardBaseTw + " " + (background === "auto" ? weatherCardTw[surface] : weatherBackgroundTw[background]) + " col-span-4 max-md:col-span-12"} aria-label="Clima agora">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-100">Clima{state.city ? ` · ${state.city}` : ""}</span>
        <span className={"inline-flex items-center gap-1.5 " + weatherAccentTw[surface]}>
          <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-white/40 bg-white/20 text-slate-50 transition-colors duration-200 hover:bg-white/30" onClick={() => { setDraftCity(configuredCity || state.city || ""); setEditing(v => !v); }} aria-label="Definir local do clima" title="Definir local do clima"><MapPin size={14} aria-hidden="true" /></button>
          <button type="button" className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-white/40 bg-white/20 px-2 text-xs font-bold text-slate-50 transition-colors duration-200 hover:bg-white/30" onClick={nextBackground} aria-label="Alterar fundo do clima" title={"Fundo do clima: " + backgroundLabel}><Palette size={14} aria-hidden="true" />{backgroundLabel}</button>
          {night ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
        </span>
      </div>
      {editing ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); saveCity(); }}>
          <input autoFocus value={draftCity} onChange={(event) => setDraftCity(event.target.value)} aria-label="Cidade para o clima" placeholder="Ex.: Rondonópolis, MT" />
          <button type="submit" className="inline-flex min-h-9 items-center rounded-lg bg-blue-600 px-3 text-sm font-bold text-slate-50 transition-colors duration-200 hover:bg-blue-600">Salvar</button>
        </form>
      ) : null}
      {state.status === "loading" ? <p className="text-sm text-slate-100">Buscando o tempo…</p> : null}
      {state.status === "error" ? (
        <p className="text-sm text-slate-100">Não consegui consultar o clima agora.<br />Toque no alfinete para definir a sua cidade.</p>
      ) : null}
      {state.status === "ready" ? (
        <>
          <div className="flex items-center gap-3">
            <Icon size={52} strokeWidth={1.7} aria-hidden="true" className={"h-12 w-12 flex-none " + weatherAccentTw[surface]} />
            <div className="grid"><b className="text-4xl font-semibold tabular-nums text-slate-50">{state.temp}°</b><span className="text-sm text-slate-100">{info?.label}</span></div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-100">
            <span className="inline-flex items-center gap-1"><Sunrise size={13} aria-hidden="true" /> Máx. {state.max}°</span>
            <span className="inline-flex items-center gap-1"><Sunset size={13} aria-hidden="true" /> Mín. {state.min}°</span>
            <span className="inline-flex items-center gap-1"><Droplets size={13} aria-hidden="true" /> {state.humidity}%</span>
            <span className="inline-flex items-center gap-1"><Wind size={13} aria-hidden="true" /> brisa</span>
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
  const navButton = "grid h-7 w-7 place-items-center rounded-lg border border-purple-200 bg-white text-purple-700 transition-colors duration-200 hover:bg-purple-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
  return (
    <article className="col-span-5 grid content-start gap-3 rounded-xl border border-purple-200 bg-linear-to-br from-violet-50 to-blue-100 p-5 text-slate-800 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900 dark:text-slate-100 max-md:col-span-12" aria-label="Calendário">
      <div className="flex items-center justify-between gap-2 border-b border-purple-200 pb-2.5 dark:border-slate-700">
        <strong className="text-sm font-bold text-slate-800 dark:text-slate-50">{monthLabel(year, month)}</strong>
        <div className="inline-flex items-center gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setCursor(new Date(year, month - 1, 1))} className={navButton}><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" aria-label="Próximo mês" onClick={() => setCursor(new Date(year, month + 1, 1))} className={navButton}><ChevronRight size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center" role="grid" aria-label={monthLabel(year, month)}>
        {WEEKDAYS.map((label, index) => <span key={label} className={weekdayTw[isWeekend(index) ? "weekend" : "weekday"]} role="columnheader">{label}</span>)}
        {cells.map((day, index) => {
          const cellState = day === null ? "blank" : isToday(day) ? "today" : isWeekend(index) ? "weekend" : "weekday";
          return (
            <span
              key={index}
              role="gridcell"
              className={"grid h-6 place-items-center rounded-lg text-xs tabular-nums " + calendarCellTw[cellState]}
            >
              {day ?? ""}
            </span>
          );
        })}
      </div>
      <p className="border-t border-purple-200 pt-2.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">{fullDate()}</p>
    </article>
  );
}

/** Widgets coloridos da tela inicial: relógio, clima e calendário. */
export function DashboardWidgets() {
  return (
    <section className="grid grid-cols-12 gap-4 bg-transparent max-md:grid-cols-1" aria-label="Seu dia agora">
      <ClockWidget />
      <WeatherWidget />
      <CalendarWidget />
    </section>
  );
}
