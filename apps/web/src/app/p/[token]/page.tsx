"use client";
import { use, useEffect, useRef, useState } from "react";
import { Send, UserRound, RotateCcw, ShieldCheck } from "lucide-react";

type Bubble = { id: string; role: "assistant" | "user"; content: string; options?: string[] };
type PublicFlow = { tenantName: string; slug: string; brand: { primaryColor: string; logoLight: string; logoDark: string; logoShape: string; showCompanyName: boolean }; theme: { backgroundKind: string; color: string; color2: string; imageUrl: string }; flow: { name: string; welcome: string; steps: Array<{ id: string; kind?: string; title: string; message: string; options: string[] }> } };

const backgroundStyle = (theme: PublicFlow["theme"]): React.CSSProperties => {
  if (theme.backgroundKind === "solid") return { background: theme.color };
  if (theme.backgroundKind === "gradient") return { background: `linear-gradient(160deg, ${theme.color2} 0%, ${theme.color} 62%, #05070A 130%)` };
  if (theme.backgroundKind === "image" && theme.imageUrl) return { background: `linear-gradient(180deg, rgba(5,7,10,.55), rgba(5,7,10,.75)), url(${JSON.stringify(theme.imageUrl)}) center/cover no-repeat fixed` };
  return { background: "radial-gradient(1100px 700px at 85% -10%, color-mix(in srgb, var(--primary) 26%, transparent), transparent 60%), radial-gradient(900px 650px at -15% 110%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%), #0B0E11" };
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
    return data as { messages: string[]; options?: string[]; finished?: boolean; handoff?: boolean; redirect?: string };
  };

  const start = async (loaded: PublicFlow) => {
    setBusy(true);
    try {
      const data = await call("");
      const messages = Array.isArray(data.messages) ? data.messages : [];
      setBubbles((items) => [...items, ...messages.map((content, i) => ({ id: crypto.randomUUID() + i, role: "assistant" as const, content: String(content ?? ""), options: i === messages.length - 1 ? data.options : undefined }))]);
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
    setBubbles([]); setFinished(false); setHandoff(false); setInput("");
    if (page) void start(page);
  };

  if (error) return (
    <main className="public-flow-shell" style={{ background: "#0B0E11" }}>
      <div className="public-flow-card public-flow-unavailable">
        <ShieldCheck size={28} aria-hidden="true" />
        <h1>Página indisponível</h1>
        <p>{error}</p>
      </div>
    </main>
  );

  if (!page) return (
    <main className="public-flow-shell" style={{ background: "#0B0E11" }}>
      <div className="public-flow-card public-flow-unavailable" role="status">
        <div className="public-flow-spinner" aria-hidden="true" />
        <p>Conectando…</p>
      </div>
    </main>
  );

  const primary = page.brand.primaryColor;
  const logo = page.brand.logoLight || page.brand.logoDark;

  return (
    <main className="public-flow-shell" style={backgroundStyle(page.theme)}>
      <section className="public-flow-card" aria-label={"Atendimento " + page.tenantName}>
        <header className="public-flow-header" style={{ borderColor: "color-mix(in srgb, " + primary + " 45%, transparent)" }}>
          <span className="public-flow-logo" style={{ background: logo ? "transparent" : primary }}>
            {logo ? <img src={logo} alt={"Logo " + page.tenantName} /> : <span className="public-flow-initials">{page.tenantName.trim().slice(0, 2).toUpperCase()}</span>}
          </span>
          <span className="public-flow-title">
            <strong>{page.brand.showCompanyName ? page.tenantName : page.flow.name}</strong>
            <small><span className="public-flow-dot" style={{ background: primary }} /> Atendimento online</small>
          </span>
          <button type="button" className="public-flow-restart" onClick={reset} title="Recomeçar conversa" aria-label="Recomeçar conversa"><RotateCcw size={16} aria-hidden="true" /></button>
        </header>

        <div className="public-flow-messages" ref={scrollRef} aria-live="polite">
          {bubbles.map((bubble) => (
            <div key={bubble.id} className={"public-flow-bubble " + (bubble.role === "user" ? "from-user" : "from-assistant")}>
              <p>{bubble.content}</p>
              {bubble.options && bubble.options.length ? (
                <div className="public-flow-options">
                  {bubble.options.map((option) => <button key={option} type="button" style={{ borderColor: primary, color: primary }} disabled={busy || finished} onClick={() => void send(option)}>{option}</button>)}
                </div>
              ) : null}
            </div>
          ))}
          {busy && !finished ? <div className="public-flow-bubble from-assistant public-flow-typing" aria-label="Digitando"><span /><span /><span /></div> : null}
          {finished ? (
            <div className="public-flow-end-card">
              <ShieldCheck size={18} aria-hidden="true" />
              <p>{handoff ? "Recebemos suas informações e a equipe certa continuará o atendimento por aqui. Em instantes alguém responde você." : "Tudo certo por aqui. Obrigado pela conversa! 🙂"}</p>
              <button type="button" className="public-flow-restart-btn" style={{ background: primary }} onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Recomeçar</button>
            </div>
          ) : null}
        </div>

        {!finished ? (
          <form className="public-flow-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <label className="sr-only" htmlFor="public-flow-input">Sua mensagem</label>
            <input id="public-flow-input" autoComplete="off" value={input} disabled={busy} onChange={(event) => setInput(event.target.value)} placeholder="Escreva sua mensagem…" aria-label="Sua mensagem" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar" style={{ background: primary }}><Send size={17} aria-hidden="true" /></button>
          </form>
        ) : null}
        {!finished ? <button type="button" className="public-flow-handoff" onClick={() => void send("Quero falar com uma pessoa")} disabled={busy}><UserRound size={13} aria-hidden="true" /> Prefiro falar com uma pessoa</button> : null}
      </section>
    </main>
  );
}
