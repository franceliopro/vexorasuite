import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const team = read("src/app/team-workspace.tsx");
const config = read("tailwind.config.ts");

const classes = [...team.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
  .map((m) => m[1] ?? m[2] ?? "")
  .join("\n");

const legadas = [
  "simple-workspace", "team-workspace", "team-hero", "team-hero-copy", "team-eyebrow",
  "team-hero-stats", "team-hero-cta", "module-tabs", "team-tabs", "team-claim-box",
  "team-claim-actions", "primary-button", "secondary-button", "text-button", "danger-text",
  "team-form", "team-form-premium", "team-form-head", "team-form-icon", "team-form-close",
  "team-form-grid", "team-form-body", "team-identity-block", "team-photo-premium",
  "team-photo-circle", "team-photo-cta", "team-sectors-fieldset", "ai-toggle",
  "team-form-footer", "team-form-actions", "team-list", "team-attendant-card",
  "team-card-head", "team-avatar", "team-card-id", "team-role-chip", "team-dept-chips",
  "team-dept-empty", "team-access-summary", "team-known-by", "team-card-actions",
  "is-inactive", "is-owner", "is-admin", "is-manager", "is-agent",
];

test("o workspace de equipe não usa classes componente legadas", () => {
  for (const classe of legadas) {
    const re = new RegExp(`(?<![\\w-])${classe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    assert.equal(re.test(classes), false, `classe componente ${classe} permaneceu`);
  }
  const literais = [...team.matchAll(/className="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(literais, ["sr-only"], "só a utility sr-only pode ser literal");
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /!important/, /@apply/, /color-mix\(/]) {
    const match = team.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  const hexEmClasse = [...team.matchAll(/className="[^"]*#[0-9a-fA-F]{3,8}/g)];
  assert.equal(hexEmClasse.length, 0, "hex direto em classe");
  for (const utility of [
    "grid min-w-0 content-start gap-token",
    "relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-token-lg border border-line bg-linear-to-br from-blue-50 to-surface px-6 py-5 shadow-token-sm",
    "inline-flex w-max max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface-2 p-1",
    "grid min-w-0 grid-cols-1 content-start gap-3 rounded-token border border-line bg-surface-2 p-3 ov-laptop:grid-cols-team-identity",
    "grid grid-cols-team-list gap-3",
    "grid content-start gap-2.5 rounded-token-lg border border-line bg-surface p-3.5 transition-transform",
    "bg-blue-600 px-brand-pad text-body font-bold text-blue-50",
  ]) {
    assert.ok(team.includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos de acessibilidade da equipe permanecem intactos", () => {
  for (const contrato of [
    'role="tablist"',
    'aria-label="Alternar entre atendentes e setores"',
    "aria-pressed={tab === \"agents\"}",
    "aria-pressed={tab === \"departments\"}",
    'role="status"',
    'role="alert"',
    'aria-label="Fechar cadastro"',
    'aria-label="Atendentes cadastrados"',
    'aria-label={"Permissões de " + r.name}',
    "data-allowed={allowed}",
    'aria-hidden="true"',
    'className="sr-only"',
  ]) {
    assert.ok(team.includes(contrato), `contrato ausente: ${contrato}`);
  }
});

test("os tokens de equipe do preset preservam as grades migradas", () => {
  for (const token of ['"team-identity"', '"team-list"']) {
    assert.ok(config.includes(token), `token ausente no preset: ${token}`);
  }
  assert.equal(config.includes("color-mix("), false, "color-mix não pode voltar ao preset");
  assert.equal(/#2E7CF6/i.test(team), false, "azul fixo não pode reaparecer na fatia");
});
