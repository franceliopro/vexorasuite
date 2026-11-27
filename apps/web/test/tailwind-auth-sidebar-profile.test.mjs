import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(web, "src", "app", file), "utf8");

const auth = read("auth-screen.tsx");
const profile = read("sidebar-profile.tsx");
const sources = { "auth-screen.tsx": auth, "sidebar-profile.tsx": profile };

/**
 * Só classes realmente aplicadas: literais em className e constantes TW
 * resolvidas. data-testid, aria-*, role, ids e callbacks nunca são classes.
 */
function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of source.matchAll(/\bclassName\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const id of match[2].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(constants.get(id[1]));
    }
  }
  return values;
}

const joinedClasses = Object.values(sources).map((source) => classValues(source).join(" ")).join(" ");
const classTokens = (source) => classValues(source).join(" ").split(/\s+/).filter(Boolean);

const exactLegacy = new Set([
  "content-card", "settings-card", "primary-button", "secondary-button",
  "text-button", "icon-button", "vx-spin", "grid-cols-rw-2",
]);
const legacyPrefix = /^(?:ov-|vx-|ib-|rw-|auth-|alarm-|platform-admin-|design-approval-)/;
const allowedVariants = /^(?:ib-narrow|ov-laptop|rw-laptop):/;

test("auth e perfil da sidebar não usam classes componente legadas", () => {
  for (const [file, source] of Object.entries(sources)) {
    for (const token of classTokens(source)) {
      const classOnly = token.replace(allowedVariants, "");
      assert.equal(exactLegacy.has(classOnly), false, `${file}: classe legada ${token}`);
      assert.doesNotMatch(classOnly, legacyPrefix, `${file}: classe legada ${token}`);
    }
  }
  assert.doesNotMatch(joinedClasses, /\b(?:primary-button|secondary-button|text-button|icon-button|vx-spin)\b/);
});

test("as duas telas usam utilities Tailwind básicas e literais completas", () => {
  for (const utility of [
    "grid min-h-dvh grid-cols-1 bg-zinc-50 bg-vx-page md:grid-cols-2",
    "relative isolate hidden flex-col justify-between gap-9 overflow-hidden p-8 text-slate-50 md:flex lg:p-12 xl:p-16",
    "inline-flex min-h-control w-full items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "absolute right-1 top-1 grid size-8 place-items-center text-ink-secondary",
    "grid gap-3.5", "grid gap-1.5", "pr-12", "min-h-0 p-0 font-bold text-blue-600",
  ]) {
    assert.ok(joinedClasses.includes(utility), `falta a utility de autenticação: ${utility}`);
  }
  for (const utility of [
    "group relative w-full",
    "flex w-full cursor-pointer list-none items-center gap-profile-gap",
    "relative grid size-profile-avatar shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft",
    "fixed inset-x-3 bottom-20 z-50 grid w-auto gap-token rounded-token-sm bg-surface p-pad text-ink shadow-token dark:bg-slate-900 dark:text-slate-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:w-64",
    "grid gap-1.5 text-body font-semibold text-ink",
    "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "border border-line bg-surface-2 px-4 text-body font-bold text-ink",
    "size-full object-cover",
  ]) {
    assert.ok(joinedClasses.includes(utility), `falta a utility do perfil: ${utility}`);
  }

  for (const [file, source] of Object.entries(sources)) {
    const constants = new Map(
      [...source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    assert.doesNotMatch(source, /const\s+[A-Za-z_$][\w$]*Tw\s*=\s*`/, `${file}: classe em template literal`);
    for (const match of source.matchAll(/\bclassName=\{([^}]*)\}/g)) {
      const expression = match[1].trim();
      assert.match(expression, /^[A-Za-z_$][\w$]*$/, `${file}: className deve resolver literal, recebeu ${expression}`);
      assert.ok(constants.has(expression), `${file}: constante TW ${expression} não é literal completo`);
    }
  }
});

test("o split do login voltou com painel slate e identidade configurável", () => {
  assert.match(auth, /grid min-h-dvh grid-cols-1 bg-zinc-50 bg-vx-page md:grid-cols-2/);
  assert.match(auth, /hidden flex-col justify-between gap-9 overflow-hidden p-8 text-slate-50 md:flex/);
  for (const stop of ["rgb(2 6 23)", "rgb(15 23 42)", "rgb(30 41 59)"]) {
    assert.ok(auth.includes(stop), `falta o tom slate ${stop}`);
  }
  for (const token of [
    "rgb(from var(--primary) r g b / .55)",
    "rgb(from var(--primary) r g b / .95)",
    "rgb(from var(--accent2) r g b / .95)",
    "bg-vx-brand-mark",
    "font-display text-h1 font-extrabold leading-tight text-slate-50",
    "Uma operação inteira, em um só lugar.",
  ]) {
    assert.ok(auth.includes(token), `login perdeu ${token}`);
  }
  assert.doesNotMatch(auth, /bg-slate-900 p-8 text-slate-50 lg:flex/);
  assert.doesNotMatch(auth + profile, /blue-dark/i);
  assert.match(profile, /dark:bg-slate-900 dark:text-slate-50/);
});

test("nenhum remendo proibido foi introduzido", () => {
  for (const [file, source] of Object.entries(sources)) {
    /* Gradientes e medidas aplicadas em style são aceitos; o resto do JSX não. */
    const withoutInlineStyles = source.replace(/style=\{\{[\s\S]*?\}\}/g, "");
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /hsl\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
    ]) {
      const match = withoutInlineStyles.match(forbidden);
      assert.equal(match, null, `${file}: remendo visual ${match?.[0]}`);
    }
    for (const token of classTokens(source)) {
      assert.doesNotMatch(token, /[[\]!]/, `${file}: classe com valor arbitrário ou !important: ${token}`);
    }
  }
});

test("os contratos funcionais e e2e de autenticação permanecem intactos", () => {
  for (const token of [
    'data-testid="auth-submit"', 'role="status"', 'role="alert"',
    'aria-label={visible ? "Ocultar senha" : "Mostrar senha"}', 'aria-pressed={visible}',
    'aria-hidden="true"',
    "onAuthenticated", "onAuthenticated(result as AuthSession)",
    "function submit(event: FormEvent)", "function switchMode(next: Mode)",
    "PASSWORD_MIN_LENGTH", "PASSWORD_REQUIREMENTS", "passwordProblem", "resetTokenFromSearch",
    'fetch("/api/backend/auth/options")', '"/api/backend/auth/register"',
    '"/api/backend/auth/login"', 'fetch("/api/backend/auth/password/forgot"',
    'fetch("/api/backend/auth/password/reset"', "window.history.replaceState",
    "Entre na sua conta", "Crie seu workspace", "Recuperar acesso", "Crie uma nova senha",
    "Criar empresa e entrar", "Enviar link", "Salvar nova senha", "Entrar",
    "Esqueceu a senha?", "Voltar para entrar", "Criar workspace",
  ]) {
    assert.ok(auth.includes(token), `auth perdeu o contrato ${token}`);
  }
  const authTestIds = [...auth.matchAll(/data-testid="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(authTestIds, ["auth-session-notice", "auth-submit", "auth-retry"]);
  assert.equal((auth.match(/aria-hidden="true"/g) ?? []).length >= 4, true);
});

test("os contratos funcionais do perfil da sidebar permanecem intactos", () => {
  for (const token of [
    "<details ref={menuRef}", "<summary", 'title="Meu perfil e equipe"',
    'role="status"', 'role="alert"', 'alt="Minha foto"',
    "<ProfilePhotoEditor compact onUpdated={onUpdated} />",
    "async function loadProfile()", "void loadProfile()", "await onUpdated()", "onTeam();",
    'fetch("/api/backend/profile", { cache: "no-store" })',
    'fetch("/api/backend/profile", {',
    'menuRef.current?.removeAttribute("open")', 'event.key==="Escape"',
    'document.addEventListener("mousedown",close)', 'document.addEventListener("keydown",escape)',
    "Meu perfil", "Carregando perfil...", "Tentar novamente", "Perfil atualizado.",
    "Salvar perfil", "Gerenciar atendentes e setores", "canManage && (",
  ]) {
    assert.ok(profile.includes(token), `perfil perdeu o contrato ${token}`);
  }
  assert.deepEqual([...profile.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]), []);
  assert.equal((profile.match(/role="status"/g) ?? []).length, 2);
});
