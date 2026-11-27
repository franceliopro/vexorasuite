import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const origins = read("src/app/lead-origins-workspace.tsx");
const departments = read("src/app/department-manager.tsx");
const companies = read("src/app/company-switcher.tsx");
const plans = read("src/app/client-plans-workspace.tsx");
const alarms = read("src/app/personal-alarms.tsx");
const screens = [origins, departments, companies, plans, alarms];

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

test("os workspaces não usam mais classes componente de botão legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|ai-toggle)\b/);
  assert.doesNotMatch(classes, /\b(?:ov|vx|ib|rw|ps)-[a-z][a-z0-9-]*/);
});

test("os workspaces usam só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = screens.join("\n").match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "border border-line bg-surface-2 px-4 text-body font-bold text-ink",
    "border border-red-600 bg-red-100 px-4 text-body font-bold text-red-600",
    "size-9 place-items-center rounded-token-sm border border-line bg-surface",
    "text-body font-bold text-red-600 transition-colors hover:bg-surface hover:text-red-700",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos dos workspaces permanecem intactos", () => {
  for (const token of [
    "/api/backend/reports/lead-origins", "Aplicar período", "Aquisição de leads", "role=\"alert\"",
  ]) assert.ok(origins.includes(token), `origens perdeu ${token}`);
  for (const token of [
    "/api/backend/departments", "/api/backend/team", "Setores da empresa", "role=\"status\"",
    "Duplicar configuração do setor", "Atendentes deste setor",
  ]) assert.ok(departments.includes(token), `setores perdeu ${token}`);
  for (const token of [
    'aria-labelledby="company-heading"', 'id="company-heading"', 'aria-label="Gerenciar empresas"',
    'aria-label="Fechar empresas"', 'role="dialog"', 'aria-controls="company-dropdown"',
    'data-testid="company-dropdown"', "createPortal(", "/api/backend/auth/companies",
  ]) assert.ok(companies.includes(token), `empresas perdeu ${token}`);
  for (const token of [
    "/api/backend/plans", "/api/backend/billing/activate", "Escolha o próximo passo",
    "role=\"status\"", "role=\"alert\"", "Ativar agora",
  ]) assert.ok(plans.includes(token), `planos perdeu ${token}`);
  for (const token of [
    "/api/backend/reminders/alarms", 'aria-pressed={weekdays.includes(day)}', 'role="switch"',
    'aria-checked={alarm.enabled}', 'aria-label="Alarmes configurados"', "Criar alarme",
  ]) assert.ok(alarms.includes(token), `alarmes perdeu ${token}`);
});

test("a página de planos do cliente usa só utilities do preset", () => {
  const planClasses = classValues(plans);
  for (const forbidden of [/\bclient-plans?(?:-[\w-]+)?\b/, /\bis-(?:featured|current|off)\b/, /color-mix\(/, /#[0-9a-fA-F]{3,8}\b/]) {
    const match = planClasses.match(forbidden);
    assert.equal(match, null, `classe legada ou remendo em planos: ${match?.[0]}`);
  }
  for (const utility of [
    "grid gap-4",
    "grid grid-cols-plans gap-3.5",
    "relative grid gap-2.25 rounded-token-lg border border-line bg-surface p-plans-card-pad",
    "border-blue-600 ring-4 ring-blue-100",
    "bg-blue-50",
    "inline-flex items-center gap-1 rounded-cf-tag bg-blue-600 px-plans-badge-x py-plans-badge-y",
    "font-display text-plans-price font-extrabold tabular-nums text-ink",
  ]) {
    assert.ok(plans.includes(utility), `falta a utility de planos ${utility}`);
  }
});
