"use client";
import { useState } from 'react';
import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, passwordProblem } from '../lib/password-reset';

const primaryTw = 'inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';
const textButtonTw = 'inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600 transition-colors hover:bg-surface hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60';
const authScreenTw = "grid min-h-dvh place-items-center bg-zinc-50 p-5";
const authPanelTw = "mx-auto grid w-full max-w-md content-center gap-4 p-8";
const authBrandTw = "flex items-center gap-2.5";
const brandMarkTw = "grid h-control w-control flex-none place-items-center rounded-brand bg-linear-to-br from-blue-100 via-blue-600 to-blue-800 font-display text-brand-mark font-extrabold text-blue-900 shadow-token-sm";
const authTitleTw = "font-display text-brand-title font-extrabold";
const authCopyTw = "text-body text-slate-950";
const authFormTw = "grid gap-3.5";
const authFieldTw = "grid gap-1.5 text-body font-semibold text-ink";
const authErrorTw = "m-0 rounded-token-sm border border-red-600/40 bg-red-100 px-3 py-2.5 text-small leading-relaxed text-red-600";
const authScreenStyle = {
  background: [
    "radial-gradient(60rem 36rem at 100% -10%, hsl(220 82% 56% / 0.12), transparent 60%)",
    "radial-gradient(48rem 30rem at -10% 110%, hsl(205 66% 52% / 0.06), transparent 58%)",
    "var(--bg)",
  ].join(","),
} as const;

export function ChangePasswordScreen() {
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return (
    <main className={authScreenTw} style={authScreenStyle}>
      <section className={authPanelTw}>
        <div className={authBrandTw}>
          <span className={brandMarkTw}>V</span>
          <strong className={authTitleTw}>Véxora Suite</strong>
        </div>
        <h1>Crie sua senha pessoal</h1>
        <p className={authCopyTw}>Antes de acessar, substitua a senha temporária. {PASSWORD_REQUIREMENTS}</p>
        <form className={authFormTw} onSubmit={async event => {
          event.preventDefault();
          setError('');
          const problem = passwordProblem(newPassword, confirmation);
          if (problem) {
            setError(problem);
            return;
          }
          setBusy(true);
          try {
            const response = await fetch('/api/backend/auth/change-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentPassword, newPassword }),
            });
            const result = await response.json();
            if (!response.ok) throw Error(result.message || 'Não foi possível alterar sua senha.');
            window.location.assign('/');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Falha de conexão.');
            setBusy(false);
          }
        }}>
          <label className={authFieldTw}>
            Senha temporária ou atual
            <input type="password" required autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e => setCurrent(e.target.value)} />
          </label>
          <label className={authFieldTw}>
            Nova senha
            <input type="password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNew(e.target.value)} />
          </label>
          <label className={authFieldTw}>
            Confirme a nova senha
            <input type="password" required minLength={PASSWORD_MIN_LENGTH} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
          </label>
          {error && <p className={authErrorTw} role="alert">{error}</p>}
          <button className={primaryTw} disabled={busy}>{busy ? 'Salvando…' : 'Salvar minha senha e entrar'}</button>
          <button type="button" className={textButtonTw} disabled={busy} onClick={async () => {
            await fetch('/api/backend/auth/logout', { method: 'POST' });
            window.location.assign('/');
          }}>Sair</button>
        </form>
      </section>
    </main>
  );
}
