import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("src/app/auth-screen.tsx");
const templates = read("src/app/business-templates.tsx");
const reminders = read("src/app/reminder-center.tsx");
const screens = [auth, templates, reminders];

function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  return values.join("\n");
}
const classes = screens.map(classValues).join("\n");

test("auth, modelos e lembretes nao usam mais classes componente de botao legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin)\b/);
});

test("auth, modelos e lembretes usam so utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "border border-line bg-surface-2 px-4 text-body font-bold text-ink",
    "size-9 place-items-center rounded-token-sm border border-line bg-surface",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos de auth, modelos e lembretes permanecem intactos", () => {
  for (const token of ["auth-submit", 'role="alert"', "Criar empresa e entrar", "passwordProblem", "resetTokenFromSearch"]) {
    assert.ok(auth.includes(token), `auth perdeu ${token}`);
  }
  for (const token of ["Tentar novamente", 'role="alert"', "business-templates", "settings-field", "Carregar"]) {
    assert.ok(templates.includes(token), `modelos perdeu ${token}`);
  }
  for (const token of [
    'aria-label="Fechar lembretes"', "Adiar 15 min", "Entendi", "snoozeAll", "dismissAll",
    'role="alertdialog"', 'aria-modal="true"',
  ]) {
    assert.ok(reminders.includes(token), `lembretes perdeu ${token}`);
  }
});

test("o centro de lembretes usa só utilities do preset", () => {
  const classes = classValues(reminders);
  for (const forbidden of [/\breminder-center(?:-[\w-]+)?\b/, /\bis-overdue\b/, /color-mix\(/, /#[0-9a-fA-F]{3,8}\b/]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `classe legada ou remendo em lembretes: ${match?.[0]}`);
  }
  for (const utility of [
    "fixed inset-0 z-reminder grid place-items-center p-5",
    "absolute inset-0 bg-overlay backdrop-blur-reminder",
    "relative grid w-full max-w-reminder-card gap-4 rounded-reminder-card border border-line bg-surface p-reminder-pad shadow-reminder-card animate-reminder-card",
    "grid size-reminder-icon place-items-center rounded-reminder-icon bg-blue-50 text-blue-600",
    "border-red-600 bg-red-100",
  ]) {
    assert.ok(reminders.includes(utility), `falta a utility de lembretes ${utility}`);
  }
});
