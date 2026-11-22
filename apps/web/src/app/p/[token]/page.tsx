"use client";
import { use, useEffect, useRef, useState, type CSSProperties } from "react";
import { Send, RotateCcw, ShieldCheck, Smartphone, Monitor } from "lucide-react";

type Bubble = { id: string; role: "assistant" | "user"; content: string; options?: string[] };
type Theme = { backgroundKind: string; color: string; color2: string; imageUrl: string; headerTitle?: string; headerSubtitle?: string; mode?: string };
type PublicFlow = { tenantName: string; slug: string; brand: { primaryColor: string; logoLight: string; logoDark: string; logoShape: string; showCompanyName: boolean }; theme: Theme; flow: { name: string; welcome: string; steps: Array<{ id: string }> } };

/*
 * Variáveis do tema da página pública são dados configuráveis, aplicados via
 * `style`. O verde continua só no tema WhatsApp (exceção permitida); os temas
 * padrão e escuro usam azul blue-700 e o escuro real slate do TW.
 */
const PF_THEME_VARS: Record<string, Record<string, string>> = {
  default: {
    "--pf-bg": "#F4EEE2",
    "--pf-card": "#FBF8EF",
    "--pf-surface": "#FFFFFF",
    "--pf-ink": "#1E2A24",
    "--pf-muted": "#6E7568",
    "--pf-header": "#1D4ED8",
    "--pf-header-ink": "#F4EEE2",
    "--pf-accent": "#B98A45",
    "--pf-user": "#1D4ED8",
    "--pf-user-ink": "#F4EEE2",
    "--pf-border": "#E2D9C8",
    "--pf-kb": "#1D4ED8",
  },
  dark: {
    "--pf-bg": "#0F172A",
    "--pf-card": "#1E293B",
    "--pf-surface": "#334155",
    "--pf-ink": "#F8FAFC",
    "--pf-muted": "#94A3B8",
    "--pf-header": "#020617",
    "--pf-header-ink": "#F8FAFC",
    "--pf-accent": "#C9A24B",
    "--pf-user": "#C9A24B",
    "--pf-user-ink": "#241A08",
    "--pf-border": "#334155",
    "--pf-kb": "#1D4ED8",
  },
  whatsapp: {
    "--pf-bg": "#ECE5DD",
    "--pf-card": "#FFFFFF",
    "--pf-surface": "#FFFFFF",
    "--pf-ink": "#111B16",
    "--pf-muted": "#5A6B61",
    "--pf-header": "#075E54",
    "--pf-header-ink": "#FFFFFF",
    "--pf-accent": "#128C7E",
    "--pf-user": "#DCF8C6",
    "--pf-user-ink": "#111B16",
    "--pf-border": "#D8D1C6",
    "--pf-kb": "#25D366",
  },
};

const shellStyle = (theme: Theme): CSSProperties => {
  if (theme.backgroundKind === "solid") return { background: theme.color };
  if (theme.backgroundKind === "gradient") return { background: `linear-gradient(160deg, ${theme.color2} 0%, ${theme.color} 62%, #05070A 130%)` };
  if (theme.backgroundKind === "image" && theme.imageUrl) return { background: `linear-gradient(180deg, rgba(20,18,12,.55), rgba(20,18,12,.78)), url(${JSON.stringify(theme.imageUrl)}) center/cover no-repeat fixed` };
  return {};
};

const themeVars = (theme: Theme, phoneMode: boolean): CSSProperties => ({
  ...(PF_THEME_VARS[theme.mode ?? "default"] ?? PF_THEME_VARS.default),
  ...shellStyle(theme),
  ...(phoneMode && theme.backgroundKind === "default" ? { background: "#0F172A" } : {}),
} as CSSProperties);

const fallbackVars = PF_THEME_VARS.default as CSSProperties;

const shellTw = "grid min-h-dvh place-items-center bg-pf-bg p-pf-shell font-pf-ui pf-mobile:p-0";
const stageTw = "relative grid w-pf-stage place-items-center";
const deviceToggleTw = "absolute -right-2 -top-2 z-pf-device inline-flex min-h-10 items-center gap-2 rounded-full border border-pf-border bg-pf-card px-pf-device-x text-pf-device font-extrabold tracking-pf-device text-pf-ink shadow-pf-device pf-mobile:hidden";
const deviceTogglePhoneTw = "border-pf-header bg-pf-header text-pf-header-ink";
const cardTw = "grid h-pf-card w-full grid-rows-pf-card overflow-hidden rounded-pf-card border border-pf-border bg-pf-card text-pf-ink shadow-pf-card pf-mobile:h-dvh pf-mobile:w-screen pf-mobile:rounded-none pf-mobile:border-0";
const cardPhoneTw = "h-pf-phone-card w-pf-phone-card rounded-pf-phone-card border-pf-frame border-pf-phone-frame shadow-pf-phone-card";
const unavailableTw = "grid place-items-center gap-4 px-pf-unavailable-x py-pf-unavailable-y text-center";
const unavailableTitleTw = "text-pf-unavailable-title font-extrabold tracking-pf-unavailable-title";
const unavailableCopyTw = "text-pf-unavailable-copy text-pf-muted";
const spinnerTw = "size-pf-spinner animate-pf-spin rounded-full border-pf-spinner border-pf-spinner-track border-t-pf-accent";
const headerTw = "flex items-center gap-pf-header border-b-2 border-pf-accent bg-pf-header px-pf-header-x py-pf-header-y text-pf-header-ink";
const avatarTw = "grid size-pf-avatar shrink-0 place-items-center overflow-hidden rounded-full border-2 border-pf-avatar-line";
const avatarImgTw = "size-full object-cover";
const initialsTw = "font-pf-display text-pf-initials font-extrabold text-pf-header-ink";
const headTextTw = "grid min-w-0 gap-pf-head-text";
const headTitleTw = "truncate font-pf-display text-pf-head-title font-semibold tracking-pf-head-title";
const headSubTw = "flex min-w-0 items-center gap-pf-head-sub truncate text-pf-head-sub opacity-pf-sub";
const onlineDotTw = "inline-block size-pf-dot shrink-0 rounded-full bg-pf-kb shadow-pf-dot";
const progressTw = "ml-auto shrink-0 rounded-full border border-pf-glass-line bg-pf-glass px-pf-progress-x py-pf-progress-y text-pf-progress font-extrabold tracking-pf-progress text-pf-header-ink";
const progressSepTw = "mx-0.5 font-semibold opacity-pf-em not-italic";
const restartTw = "grid size-pf-restart shrink-0 place-items-center rounded-pf-restart bg-pf-glass text-pf-header-ink transition-colors hover:bg-pf-glass-hover";
const taglineTw = "flex justify-center border-b border-pf-border bg-transparent px-pf-tagline-x py-pf-tagline-y";
const taglineTextTw = "text-pf-tagline font-extrabold uppercase tracking-pf-tagline text-pf-muted";
const messagesTw = "flex flex-col gap-pf-messages overflow-y-auto p-pf-messages scroll-smooth";
const bubbleTw = "max-w-pf-bubble break-words rounded-pf-bubble px-pf-bubble-x py-pf-bubble-y text-pf-bubble";
const bubbleRoleTw: Record<string, string> = {
  user: "self-end rounded-br-pf-tail bg-pf-user font-semibold text-pf-user-ink",
  assistant: "self-start rounded-bl-pf-tail border border-pf-border bg-pf-surface text-pf-ink shadow-pf-bubble",
};
const bubbleCopyTw = "m-0 whitespace-pre-line";
const optionsTw = "mt-pf-options flex flex-wrap gap-2";
const optionTw = "min-h-9 rounded-full border-pf-option border-pf-accent bg-transparent px-pf-option-x text-pf-option font-bold text-pf-ink transition-colors hover:bg-pf-accent hover:text-pf-user-ink disabled:cursor-default disabled:opacity-50";
const typingTw = "flex w-max items-center gap-pf-typing px-pf-typing-x py-pf-typing-y";
const typingDotTw = "size-pf-dot animate-pf-typing rounded-full bg-pf-muted";
const composerTw = "flex gap-pf-composer border-t border-pf-border bg-pf-card px-pf-composer-x py-pf-composer-y";
const composerInputTw = "min-h-pf-input min-w-0 flex-1 rounded-full border border-pf-border bg-pf-surface px-pf-input-x text-pf-input text-pf-ink focus:outline-2 focus:outline-offset-1 focus:outline-pf-accent";
const composerButtonTw = "grid size-pf-input shrink-0 place-items-center rounded-full bg-pf-header text-pf-header-ink transition hover:filter-pf-hover disabled:cursor-default disabled:opacity-pf-disabled";
const endCardTw = "mx-auto grid max-w-pf-end justify-items-center gap-3 rounded-pf-end border border-pf-border bg-pf-surface p-pf-end text-center";
const endCopyTw = "text-pf-end-copy text-pf-muted";
const restartButtonTw = "inline-flex min-h-10 items-center gap-2 rounded-full bg-pf-header px-pf-restart-x text-pf-restart font-extrabold text-pf-header-ink";

export default function PublicFlowPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [page, setPage] = useState<PublicFlow | null>(null);
  const [error, setError] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true);
  const [finished, setFinished] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [phoneMode, setPhoneMode] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const sessionRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const safeToken = /^[a-f0-9]{48}$/.test(token) ? token : "";

  useEffect(() => {
    if (!safeToken) { setError("Este endereço é inválido."); setBusy(false); return; }
    try {
      const saved = window.sessionStorage.getItem("public-flow:" + safeToken);
      if (saved && /^[a-zA-Z0-9-]{8,64}$/.test(saved)) sessionRef.current = saved;
      else sessionRef.current = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      window.sessionStorage.setItem("public-flow:" + safeToken, sessionRef.current);
    } catch { sessionRef.current = crypto.randomUUID().replace(/-/g, "").slice(0, 24); }
    let mounted = true;
    fetch("/api/backend/public/flows/" + safeToken, { cache: "no-store" })
      .then(async (response) => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Esta página não está disponível no momento."); return data as PublicFlow; })
      .then((data) => { if (!mounted) return; setPage(data); void start(data); })
      .catch((e) => { if (mounted) { setError(e instanceof Error ? e.message : "Esta página não está disponível no momento."); setBusy(false); } });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeToken]);

  const call = async (text: string) => {
    const response = await fetch("/api/backend/public/flows/" + safeToken + "/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionRef.current, text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Não foi possível continuar. Tente novamente.");
    return data as { messages: string[]; options?: string[]; finished?: boolean; handoff?: boolean; redirect?: string; progress?: { current: number; total: number } };
  };

  const start = async (loaded: PublicFlow) => {
    setBusy(true);
    try {
      const data = await call("");
      const messages = Array.isArray(data.messages) ? data.messages : [];
      setBubbles((items) => [...items, ...messages.map((content, i) => ({ id: crypto.randomUUID() + i, role: "assistant" as const, content: String(content ?? ""), options: i === messages.length - 1 ? data.options : undefined }))]);
      if (data.progress) setProgress(data.progress);
      if (data.finished) { setFinished(true); setHandoff(data.handoff === true); }
      if (data.redirect && /^https:\/\//.test(data.redirect)) window.location.assign(data.redirect);
    } catch (e) {
      setBubbles((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: e instanceof Error ? e.message : "Não foi possível continuar. Tente novamente." }]);
    } finally {
      setBusy(false);
    }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy || finished) return;
    setInput("");
    setBubbles((items) => [...items, { id: crypto.randomUUID(), role: "user", content: text }]);
    setBusy(true);
    try {
      const data = await call(text);
      const messages = Array.isArray(data.messages) ? data.messages : [];
      setBubbles((items) => [...items, ...messages.map((content, i) => ({ id: crypto.randomUUID() + i, role: "assistant" as const, content: String(content ?? ""), options: i === messages.length - 1 ? data.options : undefined }))]);
      if (data.progress) setProgress(data.progress);
      if (data.finished) { setFinished(true); setHandoff(data.handoff === true); }
      if (data.redirect && /^https:\/\//.test(data.redirect)) window.location.assign(data.redirect);
    } catch (e) {
      setBubbles((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: e instanceof Error ? e.message : "Não foi possível continuar. Tente novamente." }]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [bubbles, busy]);

  const reset = () => {
    try { window.sessionStorage.removeItem("public-flow:" + safeToken); } catch {}
    sessionRef.current = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    try { window.sessionStorage.setItem("public-flow:" + safeToken, sessionRef.current); } catch {}
    setBubbles([]); setFinished(false); setHandoff(false); setInput(""); setProgress(null);
    if (page) void start(page);
  };

  if (error) return (
    <main className={shellTw} style={fallbackVars}>
      <div className={unavailableTw}>
        <ShieldCheck size={28} aria-hidden="true" />
        <h1 className={unavailableTitleTw}>Página indisponível</h1>
        <p className={unavailableCopyTw}>{error}</p>
      </div>
    </main>
  );

  if (!page) return (
    <main className={shellTw} style={fallbackVars}>
      <div className={unavailableTw} role="status">
        <div className={spinnerTw} aria-hidden="true" />
        <p className={unavailableCopyTw}>Conectando.</p>
      </div>
    </main>
  );

  const logo = page.brand.logoLight || page.brand.logoDark;
  const headerTitle = page.theme.headerTitle?.trim() || (page.brand.showCompanyName !== false ? page.tenantName : page.flow.name);
  const headerSubtitle = page.theme.headerSubtitle?.trim() || `${page.tenantName} · Atendimento online`;

  return (
    <main className={phoneMode ? shellTw + " bg-pf-phone" : shellTw} style={themeVars(page.theme, phoneMode)}>
      <div className={stageTw}>
        <button type="button" className={phoneMode ? deviceToggleTw + " " + deviceTogglePhoneTw : deviceToggleTw} onClick={() => setPhoneMode(v => !v)} aria-pressed={phoneMode} title={phoneMode ? "Ver no computador" : "Testar no celular"}>{phoneMode ? <Monitor size={15} aria-hidden="true" /> : <Smartphone size={15} aria-hidden="true" />}<span>{phoneMode ? "Computador" : "Testar no celular"}</span></button>

        <section className={phoneMode ? cardTw + " " + cardPhoneTw : cardTw} aria-label={"Atendimento " + page.tenantName}>
          <header className={headerTw}>
            <span className={avatarTw} style={{ background: logo ? "transparent" : "var(--pf-header)" }}>
              {logo ? <img src={logo} alt={"Logo " + page.tenantName} className={avatarImgTw} /> : <span className={initialsTw}>{page.tenantName.trim().slice(0, 2).toUpperCase()}</span>}
            </span>
            <span className={headTextTw}>
              <strong className={headTitleTw}>{headerTitle}</strong>
              <small className={headSubTw}><span className={onlineDotTw} aria-hidden="true" />{headerSubtitle}</small>
            </span>
            <span className={progressTw} aria-live="polite">{progress ? <>{progress.current}<em className={progressSepTw}> de </em>{progress.total}</> : "•"}</span>
            <button type="button" className={restartTw} onClick={reset} title="Recomeçar conversa" aria-label="Recomeçar conversa"><RotateCcw size={17} aria-hidden="true" /></button>
          </header>
          <div className={taglineTw}><span className={taglineTextTw}>{page.tenantName.toUpperCase().split(" ").join(" · ")}</span></div>

          <div className={messagesTw} ref={scrollRef} aria-live="polite">
            {bubbles.map((bubble) => (
              <div key={bubble.id} className={bubbleTw + " " + (bubbleRoleTw[bubble.role] ?? bubbleRoleTw.assistant)}>
                <p className={bubbleCopyTw}>{bubble.content}</p>
                {bubble.options && bubble.options.length ? (
                  <div className={optionsTw}>
                    {bubble.options.map((option) => <button key={option} type="button" disabled={busy || finished} onClick={() => void send(option)} className={optionTw}>{option}</button>)}
                  </div>
                ) : null}
              </div>
            ))}
            {busy && !finished ? <div className={bubbleTw + " " + bubbleRoleTw.assistant + " " + typingTw} aria-label="Digitando">{[0, 1, 2].map((i) => <span key={i} className={typingDotTw} style={{ animationDelay: `${i * 150}ms` }} />)}</div> : null}
            {finished ? (
              <div className={endCardTw}>
                <ShieldCheck size={18} aria-hidden="true" />
                <p className={endCopyTw}>{handoff ? "Recebemos suas informações e a equipe responsável continuará o atendimento por aqui. Em instantes alguém responde você." : "Tudo certo por aqui. Obrigado pela conversa!"}</p>
                <button type="button" className={restartButtonTw} onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Recomeçar</button>
              </div>
            ) : null}
          </div>

          {!finished ? (
            <form className={composerTw} onSubmit={(event) => { event.preventDefault(); void send(); }}>
              <label className="sr-only" htmlFor="pf-input">Sua mensagem</label>
              <input id="pf-input" className={composerInputTw} autoComplete="off" value={input} disabled={busy} onChange={(event) => setInput(event.target.value)} placeholder="Escreva sua mensagem…" aria-label="Sua mensagem" />
              <button type="submit" className={composerButtonTw} disabled={busy || !input.trim()} aria-label="Enviar"><Send size={18} aria-hidden="true" /></button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
