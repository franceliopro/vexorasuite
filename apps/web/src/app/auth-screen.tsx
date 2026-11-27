"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, passwordProblem, resetTokenFromSearch } from "../lib/password-reset";

const submitTw = "inline-flex min-h-control w-full items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const brandMarkTw = "grid h-control w-control flex-none place-items-center rounded-brand bg-vx-brand-mark font-display text-brand-mark font-extrabold text-blue-900 shadow-vx-brand";
export type SegmentNavigationChild = { label: string; target?: string; icon?: string };
export type SegmentNavigationItem = SegmentNavigationChild & { children?: SegmentNavigationChild[] };
export type SegmentProfile = {
  id: string; name: string; overview: "GENERIC" | "SCHOOL"; vocabulary: Record<string,string>;
  modules: string[]; departments: string[]; flows: string[]; aiUses: string[]; brand?: Record<string,string>;
  navigation: { section: string; items: SegmentNavigationItem[] }[];
};
export interface AuthSession {
  allowedModules?:string[]; departmentIds?:string[]; paymentProvider?: "ASAAS" | "STRIPE" | "INFINITEPAY"; segmentProfile?: SegmentProfile | null;
  user: { id: string; name: string; email: string; avatarUrl?:string|null; avatarSource?:string|null;isPlatformAdmin?:boolean;mustChangePassword?:boolean };
  tenant: { id: string; name: string; slug: string;kind?:string; plan?: { name: string; code: string; priceCents: number; cycle: string } | null };
  role: string;
}

type Mode = "login" | "register" | "forgot" | "reset";

function EyeToggle({visible,onToggle}:{visible:boolean;onToggle:()=>void}) {
  return <button className="absolute right-1 top-1 grid size-8 place-items-center text-ink-secondary" type="button" onClick={onToggle} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} title={visible ? "Ocultar senha" : "Mostrar senha"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{visible ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5 0 8.3 4.5 9 7-.3 1.1-1.1 2.3-2.2 3.3" /><path d="M6.2 6.2C4.4 7.4 3.3 9.2 3 12c.7 2.5 4 7 9 7 1.2 0 2.3-.3 3.3-.8" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}</svg></button>;
}

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [registrationEnabled,setRegistrationEnabled]=useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [resetToken, setResetToken] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/backend/auth/options").then(r => r.ok ? r.json() : null).then(d => setRegistrationEnabled(d?.registrationEnabled === true)).catch(() => {});
    // A reset link opens the app with ?reset=<token>; the form then asks for the new password.
    const token = resetTokenFromSearch(window.location.search);
    if (token) { setResetToken(token); setMode("reset"); }
  }, []);

  function switchMode(next: Mode) {
    setMode(next); setError(""); setNotice(""); setPassword(""); setConfirmation("");
    if (next !== "reset" && resetToken) {
      // Leaving the reset flow must not leave a token sitting in the address bar.
      window.history.replaceState(null, "", window.location.pathname);
      setResetToken("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "forgot") {
        const response = await fetch("/api/backend/auth/password/forgot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, ...(tenantSlug.trim() ? { tenantSlug } : {}) }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message || "Não foi possível enviar o pedido.");
        }
        // Same answer whether or not the address exists, like the API.
        setNotice("Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. O link expira em 30 minutos.");
        return;
      }
      if (mode === "reset") {
        const problem = passwordProblem(password, confirmation);
        if (problem) throw new Error(problem);
        const response = await fetch("/api/backend/auth/password/reset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message || "Não foi possível redefinir a senha.");
        window.history.replaceState(null, "", window.location.pathname);
        setResetToken("");
        setPassword("");
        setConfirmation("");
        setMode("login");
        setNotice("Senha alterada. Entre com a nova senha.");
        return;
      }
      const registering = mode === "register";
      if (registering) {
        const problem = passwordProblem(password);
        if (problem) throw new Error(problem);
      }
      const response = await fetch(registering ? "/api/backend/auth/register" : "/api/backend/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(registering ? { tenantName, name, email, password } : { tenantSlug, email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message || "Não foi possível autenticar.");
      onAuthenticated(result as AuthSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const heading = mode === "register" ? "Crie seu workspace" : mode === "forgot" ? "Recuperar acesso" : mode === "reset" ? "Crie uma nova senha" : "Entre na sua conta";
  const description = mode === "register"
    ? "Cadastre a empresa e crie a conta proprietária para começar."
    : mode === "forgot"
      ? "Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha."
      : mode === "reset"
        ? "Escolha uma senha nova. Todas as sessões abertas serão encerradas."
        : "Acesse sua empresa para acompanhar os atendimentos.";


  return (
    <main
      className="grid min-h-dvh grid-cols-1 bg-zinc-50 bg-vx-page md:grid-cols-2"
      style={{ backgroundImage: "radial-gradient(60rem 36rem at 100% -10%, rgb(from var(--primary) r g b / .12), transparent 60%),radial-gradient(48rem 30rem at -10% 110%, rgb(from var(--accent2) r g b / .06), transparent 58%)" }}
    >
      <aside
        className="relative isolate hidden flex-col justify-between gap-9 overflow-hidden p-8 text-slate-50 md:flex lg:p-12 xl:p-16"
        style={{ background: "linear-gradient(155deg, rgb(2 6 23) 0%, rgb(15 23 42) 48%, rgb(30 41 59) 100%)" }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: "linear-gradient(rgb(from var(--primary) r g b / .06) 1px,transparent 1px),linear-gradient(90deg,rgb(from var(--primary) r g b / .06) 1px,transparent 1px)", backgroundSize: "34px 34px", maskImage: "radial-gradient(70% 60% at 50% 30%, black, transparent 78%)", WebkitMaskImage: "radial-gradient(70% 60% at 50% 30%, black, transparent 78%)" }} />
        <span aria-hidden="true" className="pointer-events-none absolute -z-10 aspect-square rounded-full opacity-60" style={{ right: "-18%", top: "-18%", width: "74%", background: "radial-gradient(circle, rgb(from var(--primary) r g b / .55), transparent 68%)" }} />
        <div className="relative flex items-center gap-3"><span className={brandMarkTw}>V</span><span className="font-display text-brand-title font-extrabold text-slate-50">véxora<small className="mt-1 block text-brand-badge font-extrabold tracking-brand-badge" style={{ color: "rgb(from var(--primary) r g b / .95)" }}>SUITE</small></span></div>
        <div className="relative grid max-w-catalog-search gap-4">
          <p className="text-nav-section font-extrabold uppercase tracking-fin-eyebrow" style={{ color: "rgb(from var(--accent2) r g b / .95)" }}>INTELIGÊNCIA OPERACIONAL</p>
          <h2 className="font-display text-h1 font-extrabold leading-tight text-slate-50">Uma operação inteira, em um só lugar.</h2>
          <p className="text-sm leading-relaxed text-slate-300">Atendimento, CRM, automação e resultados conectados com a identidade da sua empresa — sem ruído e sem retrabalho.</p>
        </div>
        <ul className="relative grid list-none gap-3 p-0 text-sm text-slate-200">
          <li className="flex items-center gap-2.5"><span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ background: "rgb(from var(--primary) r g b / 1)", boxShadow: "0 0 0 4px rgb(from var(--primary) r g b / .16)" }} />Atendimento humano no centro da operação</li>
          <li className="flex items-center gap-2.5"><span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ background: "rgb(from var(--primary) r g b / 1)", boxShadow: "0 0 0 4px rgb(from var(--primary) r g b / .16)" }} />Automação determinística antes da IA</li>
          <li className="flex items-center gap-2.5"><span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ background: "rgb(from var(--primary) r g b / 1)", boxShadow: "0 0 0 4px rgb(from var(--primary) r g b / .16)" }} />Dados e credenciais isolados por empresa</li>
        </ul>
        <p className="relative text-2xs uppercase tracking-fin-label text-slate-300">Ambiente seguro · multiempresa</p>
      </aside>
      <section className="relative mx-auto grid w-full max-w-catalog-search content-center gap-4 bg-white p-7 dark:bg-slate-900 sm:p-10 lg:p-16">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-7 top-0 h-px md:hidden" style={{ background: "linear-gradient(90deg,transparent,rgb(from var(--primary) r g b / .6),transparent)" }} />
        <div className="flex items-center gap-2.5"><span className={brandMarkTw}>V</span><span><strong className="font-display text-brand-title font-extrabold">véxora</strong><small className="mt-1 block text-brand-badge font-extrabold tracking-brand-badge text-ink-secondary">SUITE</small></span></div>
        <p className="text-nav-section font-extrabold uppercase tracking-fin-eyebrow text-blue-600">AMBIENTE DE OPERAÇÕES</p>
        <h1>{heading}</h1>
        <p className="text-body text-ink-secondary">{description}</p>
        <form onSubmit={submit} className="grid gap-3.5">
          {mode === "register" ? <>
            <label className="grid gap-1.5">Nome da empresa<input value={tenantName} onChange={(event) => setTenantName(event.target.value)} minLength={2} maxLength={100} required autoComplete="organization" /></label>
            <label className="grid gap-1.5">Seu nome<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required autoComplete="name" /></label>
          </> : null}
          {mode === "login" ? <label className="grid gap-1.5">Identificador da empresa<input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} minLength={3} maxLength={80} required autoComplete="organization" placeholder="Identificador fornecido pela administração" /></label> : null}
          {mode === "forgot" ? <label className="grid gap-1.5">Identificador da empresa (opcional)<input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} maxLength={80} autoComplete="organization" placeholder="Ajuda a localizar a conta" /></label> : null}
          {mode !== "reset" ? <label className="grid gap-1.5">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required autoComplete="email" /></label> : null}
          {mode !== "forgot" ? <label className="grid gap-1.5">{mode === "reset" ? "Nova senha" : "Senha"}<div className="relative"><input className="pr-12" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "login" ? 1 : PASSWORD_MIN_LENGTH} maxLength={128} required autoComplete={mode === "login" ? "current-password" : "new-password"} /><EyeToggle visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} /></div></label> : null}
          {mode === "reset" ? <label className="grid gap-1.5">Repita a nova senha<input type={showPassword ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={PASSWORD_MIN_LENGTH} maxLength={128} required autoComplete="new-password" /></label> : null}
          {notice ? <p className="rounded-token-sm bg-blue-50 px-3.5 py-3 text-body text-blue-800" role="status">{notice}</p> : null}
          {error ? <p className="text-body text-danger" role="alert">{error}</p> : null}
          <button data-testid="auth-submit" className={submitTw} type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "register" ? "Criar empresa e entrar" : mode === "forgot" ? "Enviar link" : mode === "reset" ? "Salvar nova senha" : "Entrar"}</button>
        </form>
        {mode === "login" ? <div className="flex flex-wrap items-center gap-1.5 text-body text-ink-secondary"><button className="min-h-0 p-0 font-bold text-blue-600" type="button" onClick={() => switchMode("forgot")}>Esqueceu a senha?</button></div> : null}
        {mode === "forgot" || mode === "reset" ? <div className="flex flex-wrap items-center gap-1.5 text-body text-ink-secondary"><span>{mode === "forgot" ? "Lembrou a senha?" : "Não solicitou a troca?"}</span><button className="min-h-0 p-0 font-bold text-blue-600" type="button" onClick={() => switchMode("login")}>Voltar para entrar</button></div> : null}
        {registrationEnabled && mode !== "forgot" && mode !== "reset" ? <div className="flex flex-wrap items-center gap-1.5 text-body text-ink-secondary"><span>{mode === "register" ? "Já tem uma conta?" : "Primeira vez na Véxora Suite?"}</span><button className="min-h-0 p-0 font-bold text-blue-600" type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Entrar" : "Criar workspace"}</button></div> : null}
        {mode === "register" || mode === "reset" ? <p className="text-body text-ink-secondary">{PASSWORD_REQUIREMENTS}</p> : null}
        {mode === "register" ? <p className="text-body text-ink-secondary">Guarde o identificador da empresa retornado após o cadastro.</p> : null}
      </section>
    </main>
  );
}
