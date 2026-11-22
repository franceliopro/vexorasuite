import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("src/app/auth-screen.tsx");
const alarms = read("src/app/alarm-center.tsx");
const css = read("src/app/vexora.css");
const sources = [auth, alarms];

/** className direto, literais dentro de expressões e constantes TW resolvidas. */
function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const id of match[2].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(constants.get(id[1]));
    }
  }
  return values.join("\n");
}
const classes = sources.map(classValues).join("\n");
const hasClass = (name) => new RegExp(`(^|\\s)${name.replace(/[-]/g, "\\-")}($|\\s)`).test(classes);

test("auth e alarmes não usam mais classes componente decorativas", () => {
  const forbidden = [
    "auth-screen", "auth-screen-split", "auth-brand-panel", "auth-brand-lockup",
    "auth-brand-name", "auth-brand-copy", "auth-brand-points", "auth-brand-foot",
    "auth-panel", "auth-brand", "auth-form", "auth-field", "auth-password-wrap",
    "auth-password-toggle", "auth-notice", "auth-switch", "auth-footnote",
    "auth-description", "auth-error", "brand-mark",
    "alarm-card", "alarm-card-icon", "alarm-eyebrow", "alarm-firing-list",
    "alarm-firing-item", "alarm-actions",
  ];
  for (const name of forbidden) assert.equal(hasClass(name), false, `classe legada: ${name}`);
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|icon-button)\b/);
});

test("auth e alarmes usam só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = sources.join("\n").match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  assert.doesNotMatch(alarms, /\banimate-vx-in\b|\bbg-(?:blue|sky)-\d|\btext-(?:blue|sky)-\d/);
  for (const utility of [
    "min-h-dvh", "md:grid-cols-2", "bg-zinc-50 bg-vx-page", "grid-cols-1", "md:flex",
    "max-w-catalog-search", "grid h-control w-control flex-none place-items-center rounded-brand bg-vx-brand-mark",
    "text-nav-section font-extrabold uppercase tracking-fin-eyebrow",
    "min-h-control w-full items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "absolute right-1 top-1 grid size-8 place-items-center text-ink-secondary",
    "rounded-token-sm bg-blue-50 px-3.5 py-3 text-body text-blue-800",
    "grid gap-3.5", "grid gap-1.5", "pr-12", "min-h-0 p-0 font-bold text-blue-600",
    "fixed inset-0 grid place-items-center bg-slate-900/90 p-5 backdrop-blur-md", "max-h-phone-frame",
    "max-w-calendar-event-modal", "bg-linear-to-br from-slate-800 to-slate-900",
    "size-26", "text-xs font-heading uppercase tracking-fin-eyebrow text-slate-300",
    "grid w-full gap-4.5", "mt-1.5 text-body text-slate-300",
    "mt-3 flex flex-wrap items-center justify-center gap-2.5",
    "min-h-14 items-center justify-center gap-2.5 rounded-fin-figure",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("contratos de auth e alarmes permanecem intactos", () => {
  for (const token of [
    'aria-label={visible ? "Ocultar senha" : "Mostrar senha"}', 'aria-pressed={visible}',
    'role="status"', 'role="alert"', "auth-submit", "Criar empresa e entrar",
    "/api/backend/auth/options", "/api/backend/auth/password/forgot",
    "/api/backend/auth/password/reset", "/api/backend/auth/register", "/api/backend/auth/login",
    "PASSWORD_REQUIREMENTS", "passwordProblem", "resetTokenFromSearch", "onAuthenticated",
    "switchMode", "Esqueceu a senha?", "Voltar para entrar", "Criar workspace",
    'aria-hidden="true"',
  ]) assert.ok(auth.includes(token), `auth perdeu ${token}`);

  for (const token of [
    'role="alertdialog"', 'aria-modal="true"',
    'aria-label={ringing.length === 1 ? "Alarme tocando" : "Alarmes tocando"}',
    'zIndex: "var(--z-reminder, 9500)"', "alarm-snooze", "alarm-stop", "Adiar 5 min", "Parar",
    'onClick={() => snooze(alarm)}', 'onClick={() => dismiss(alarm)}',
    'aria-hidden="true"', "key={alarm.id}", "if (!ringing.length) return null;",
    'fetch("/api/backend/reminders/alarms", { cache: "no-store" })',
    'method: "PUT"', "FIRED_KEY", "SNOOZED_KEY", "speechSynthesis", "AudioContext",
  ]) assert.ok(alarms.includes(token), `alarmes perderam ${token}`);
});

test("CSS legado das duas fatias foi removido sem quebrar a camada dos alarmes", () => {
  for (const selector of [
    ".auth-screen-split{", ".auth-brand-panel", ".auth-brand-copy", ".auth-brand-points",
    ".auth-password-wrap", ".auth-password-toggle{", ".auth-notice{", ".auth-switch{",
    ".alarm-card", ".alarm-card-icon", ".alarm-eyebrow{", ".alarm-firing-list{",
    ".alarm-firing-item", ".alarm-actions{", ".alarm-snooze{", ".alarm-stop{",
    "@keyframes alarm-pulse",
  ]) assert.equal(css.includes(selector), false, `CSS órfão: ${selector}`);
  assert.match(css, /\.alarm-overlay\{z-index:var\(--z-reminder\)\}/);
  assert.match(css, /\.auth-panel button\[type=submit\]\{/);
  assert.doesNotMatch(css, /\.auth-panel \.auth-submit/);
});
