"use client";
import { use, useEffect, useRef, useState } from "react";
import { Send, UserRound, RotateCcw, ShieldCheck, Smartphone, Monitor, MessageCircle } from "lucide-react";

type Bubble = { id: string; role: "assistant" | "user"; content: string; options?: string[] };
type Theme = { backgroundKind: string; color: string; color2: string; imageUrl: string; headerTitle?: string; headerSubtitle?: string };
type PublicFlow = { tenantName: string; slug: string; brand: { primaryColor: string; logoLight: string; logoDark: string; logoShape: string; showCompanyName: boolean }; theme: Theme; flow: { name: string; welcome: string; steps: Array<{ id: string }> } };

const CREAM_DEFAULT = { shell: "#F4EEE2", card: "#FBF8EF", ink: "#1E2A24", muted: "#6E7568", green: "#173A2B", greenSoft: "#24503C", gold: "#B98A45", goldDeep: "#8A6A2E", bubbleUser: "#173A2B", bubbleBot: "#FFFFFF", bubbleBotInk: "#1E2A24", hairline: "#E2D9C8" };

const shellStyle = (theme: Theme): React.CSSProperties => {
  if (theme.backgroundKind === "solid") return { background: theme.color };
  if (theme.backgroundKind === "gradient") return { background: `linear-gradient(160deg, ${theme.color2} 0%, ${theme.color} 62%, #05070A 130%)` };
  if (theme.backgroundKind === "image" && theme.imageUrl) return { background: `linear-gradient(180deg, rgba(20,18,12,.55), rgba(20,18,12,.78)), url(${JSON.stringify(theme.imageUrl)}) center/cover no-repeat fixed` };
  return {};
};

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
    <main className="pf-shell" style={{ background: CREAM_DEFAULT.shell }}>
      <div className="pf-card pf-unavailable">
        <ShieldCheck size={28} aria-hidden="true" />
        <h1>Página indisponível</h1>
        <p>{error}</p>
      </div>
    </main>
  );

  if (!page) return (
    <main className="pf-shell" style={{ background: CREAM_DEFAULT.shell }}>
      <div className="pf-card pf-unavailable" role="status">
        <div className="pf-spinner" aria-hidden="true" />
        <p>Conectando.</p>
      </div>
    </main>
  );

  const primary = page.brand.primaryColor || "#173A2B";
  const logo = page.brand.logoLight || page.brand.logoDark;
  const themeDefault = page.theme.backgroundKind === "default";
  const headerTitle = page.theme.headerTitle?.trim() || (page.brand.showCompanyName !== false ? page.tenantName : page.flow.name);
  const headerSubtitle = page.theme.headerSubtitle?.trim() || `${page.tenantName} · Atendimento online`;
  const shellVars: React.CSSProperties = themeDefault ? { ["--cream" as any]: CREAM_DEFAULT.shell, ["--card" as any]: CREAM_DEFAULT.card, ["--ink" as any]: CREAM_DEFAULT.ink, ["--muted" as any]: CREAM_DEFAULT.muted, ["--green" as any]: primary || CREAM_DEFAULT.green, ["--gold" as any]: CREAM_DEFAULT.gold, ["--hairline" as any]: CREAM_DEFAULT.hairline } : {};

  return (
    <main className={"pf-shell" + (phoneMode ? " is-phone-mode" : "")} style={themeDefault ? shellVars : shellStyle(page.theme)}>
      <div className="pf-stage">
        <button type="button" className="pf-device-toggle" onClick={() => setPhoneMode(v => !v)} aria-pressed={phoneMode} title={phoneMode ? "Ver no computador" : "Testar no celular"}>{phoneMode ? <Monitor size={15} aria-hidden="true" /> : <Smartphone size={15} aria-hidden="true" />}<span>{phoneMode ? "Computador" : "Testar no celular"}</span></button>

        <section className="pf-card" aria-label={"Atendimento " + page.tenantName}>
          <header className="pf-header">
            <span className="pf-avatar" style={{ background: logo ? "transparent" : "var(--green)" }}>
              {logo ? <img src={logo} alt={"Logo " + page.tenantName} /> : <span className="pf-initials">{page.tenantName.trim().slice(0, 2).toUpperCase()}</span>}
            </span>
            <span className="pf-head-text">
              <strong className="pf-head-title">{headerTitle}</strong>
              <small className="pf-head-sub"><span className="pf-online-dot" aria-hidden="true" />{headerSubtitle}</small>
            </span>
            <span className="pf-progress" aria-live="polite">{progress ? <>{progress.current}<em> de </em>{progress.total}</> : "•"}</span>
            <button type="button" className="pf-restart" onClick={reset} title="Recomeçar conversa" aria-label="Recomeçar conversa"><RotateCcw size={17} aria-hidden="true" /></button>
          </header>
          <div className="pf-tagline"><span>{page.tenantName.toUpperCase().split(" ").join(" · ")}</span></div>

          <div className="pf-messages" ref={scrollRef} aria-live="polite">
            {bubbles.map((bubble) => (
              <div key={bubble.id} className={"pf-bubble " + (bubble.role === "user" ? "from-user" : "from-assistant")}>
                <p>{bubble.content}</p>
                {bubble.options && bubble.options.length ? (
                  <div className="pf-options">
                    {bubble.options.map((option) => <button key={option} type="button" disabled={busy || finished} onClick={() => void send(option)}>{option}</button>)}
                  </div>
                ) : null}
              </div>
            ))}
            {busy && !finished ? <div className="pf-bubble from-assistant pf-typing" aria-label="Digitando"><span /><span /><span /></div> : null}
            {finished ? (
              <div className="pf-end-card">
                <ShieldCheck size={18} aria-hidden="true" />
                <p>{handoff ? "Recebemos suas informações e a equipe responsável continuará o atendimento por aqui. Em instantes alguém responde você." : "Tudo certo por aqui. Obrigado pela conversa!"}</p>
                <button type="button" className="pf-restart-btn" onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Recomeçar</button>
              </div>
            ) : null}
          </div>

          {!finished && <button type="button" className="pf-handoff-bar" onClick={() => void send("Quero falar com uma pessoa")} disabled={busy}><MessageCircle size={18} aria-hidden="true" /><span>Falar com a equipe responsável</span></button>}

          {!finished ? (
            <form className="pf-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
              <label className="sr-only" htmlFor="pf-input">Sua mensagem</label>
              <input id="pf-input" autoComplete="off" value={input} disabled={busy} onChange={(event) => setInput(event.target.value)} placeholder="Escreva sua mensagem…" aria-label="Sua mensagem" />
              <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar"><Send size={18} aria-hidden="true" /></button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
