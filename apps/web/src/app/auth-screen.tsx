"use client";

import { useEffect, useState, type FormEvent } from "react";
import { passwordProblem, resetTokenFromSearch } from "../lib/password-reset";

export interface AuthSession {
  allowedModules?:string[]; departmentIds?:string[];
  user: { id: string; name: string; email: string; avatarUrl?:string|null; avatarSource?:string|null;isPlatformAdmin?:boolean;mustChangePassword?:boolean };
  tenant: { id: string; name: string; slug: string;kind?:string };
  role: string;
}

type Mode = "login" | "register" | "forgot" | "reset";

function EyeToggle({visible,onToggle}:{visible:boolean;onToggle:()=>void}) {
  return <button className="auth-password-toggle" type="button" onClick={onToggle} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} title={visible ? "Ocultar senha" : "Mostrar senha"}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{visible ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5 0 8.3 4.5 9 7-.3 1.1-1.1 2.3-2.2 3.3" /><path d="M6.2 6.2C4.4 7.4 3.3 9.2 3 12c.7 2.5 4 7 9 7 1.2 0 2.3-.3 3.3-.8" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}</svg></button>;
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
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand"><span className="brand-mark">V</span><span><strong>véxora</strong><small>SUITE</small></span></div>
        <p className="eyebrow">AMBIENTE DE OPERAÇÕES</p>
        <h1>{heading}</h1>
        <p className="auth-description">{description}</p>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" ? <>
            <label className="auth-field">Nome da empresa<input value={tenantName} onChange={(event) => setTenantName(event.target.value)} minLength={2} maxLength={100} required autoComplete="organization" /></label>
            <label className="auth-field">Seu nome<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required autoComplete="name" /></label>
          </> : null}
          {mode === "login" ? <label className="auth-field">Identificador da empresa<input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} minLength={3} maxLength={80} required autoComplete="organization" placeholder="Identificador fornecido pela administração" /></label> : null}
          {mode === "forgot" ? <label className="auth-field">Identificador da empresa (opcional)<input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} maxLength={80} autoComplete="organization" placeholder="Ajuda a localizar a conta" /></label> : null}
          {mode !== "reset" ? <label className="auth-field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required autoComplete="email" /></label> : null}
          {mode !== "forgot" ? <label className="auth-field">{mode === "reset" ? "Nova senha" : "Senha"}<div className="auth-password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "login" ? 1 : 12} maxLength={128} required autoComplete={mode === "login" ? "current-password" : "new-password"} /><EyeToggle visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} /></div></label> : null}
          {mode === "reset" ? <label className="auth-field">Repita a nova senha<input type={showPassword ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={128} required autoComplete="new-password" /></label> : null}
          {notice ? <p className="auth-notice" role="status">{notice}</p> : null}
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "register" ? "Criar empresa e entrar" : mode === "forgot" ? "Enviar link" : mode === "reset" ? "Salvar nova senha" : "Entrar"}</button>
        </form>
        {mode === "login" ? <div className="auth-switch"><button type="button" onClick={() => switchMode("forgot")}>Esqueceu a senha?</button></div> : null}
        {mode === "forgot" || mode === "reset" ? <div className="auth-switch"><span>{mode === "forgot" ? "Lembrou a senha?" : "Não solicitou a troca?"}</span><button type="button" onClick={() => switchMode("login")}>Voltar para entrar</button></div> : null}
        {registrationEnabled && mode !== "forgot" && mode !== "reset" ? <div className="auth-switch"><span>{mode === "register" ? "Já tem uma conta?" : "Primeira vez na Véxora Suite?"}</span><button type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")}>{mode === "register" ? "Entrar" : "Criar workspace"}</button></div> : null}
        {mode === "register" ? <p className="auth-footnote">A senha deve ter pelo menos 12 caracteres. Guarde o identificador da empresa retornado após o cadastro.</p> : null}
      </section>
    </main>
  );
}
