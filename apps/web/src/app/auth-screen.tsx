"use client";

import { useState, type FormEvent } from "react";

export interface AuthSession {
  user: { id: string; name: string; email: string };
  tenant: { id: string; name: string; slug: string };
  role: string;
}

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
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

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-brand"><span className="brand-mark">V</span><span><strong>véxora</strong><small>SUITE</small></span></div>
        <p className="eyebrow">AMBIENTE DE OPERAÇÕES</p>
        <h1>{mode === "register" ? "Crie seu workspace" : "Entre na sua conta"}</h1>
        <p className="auth-description">{mode === "register" ? "Cadastre a empresa e crie a conta proprietária para começar." : "Acesse sua empresa para acompanhar os atendimentos."}</p>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" ? <>
            <label className="auth-field">Nome da empresa<input value={tenantName} onChange={(event) => setTenantName(event.target.value)} minLength={2} maxLength={100} required autoComplete="organization" /></label>
            <label className="auth-field">Seu nome<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required autoComplete="name" /></label>
          </> : <label className="auth-field">Identificador da empresa<input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} minLength={3} maxLength={80} required autoComplete="organization" placeholder="Ex.: rastreabem-abc123" /></label>}
          <label className="auth-field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required autoComplete="email" /></label>
          <label className="auth-field">Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "register" ? 12 : 1} maxLength={128} required autoComplete={mode === "register" ? "new-password" : "current-password"} /></label>
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "register" ? "Criar empresa e entrar" : "Entrar"}</button>
        </form>
        <div className="auth-switch"><span>{mode === "register" ? "Já tem uma conta?" : "Primeira vez na Véxora Suite?"}</span><button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}>{mode === "register" ? "Entrar" : "Criar workspace"}</button></div>
        {mode === "register" ? <p className="auth-footnote">A senha deve ter pelo menos 12 caracteres. Guarde o identificador da empresa retornado após o cadastro.</p> : null}
      </section>
    </main>
  );
}
