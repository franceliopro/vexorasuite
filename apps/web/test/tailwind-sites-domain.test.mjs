import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const domain = read("src/app/sites-domain-config.tsx");
const config = read("tailwind.config.ts");
const theme = read("src/app/theme.css");

/** Dados, hooks e aria não são classes; removemos só o que pode gerar falso positivo. */
const semDados = domain
  .replace(/style=\{\{[^}]*\}\}/g, "");

const legadas = [
  "content-card", "sites-domain-config", "sites-domain-head", "sites-domain-icon",
  "sites-domain-title", "sites-domain-sub", "sites-domain-no-perm", "sites-domain-steps",
  "sites-domain-step", "sites-domain-step-badge", "sites-domain-step-label",
  "sites-domain-error", "sites-domain-field-block", "sites-domain-field-label",
  "sites-domain-field-tag", "sites-domain-input-group", "sites-domain-input-alert",
  "sites-domain-input-ok", "sites-domain-error-text", "sites-domain-field-hint",
  "sites-domain-status-row", "sites-domain-status-card", "sites-domain-status-head",
  "sites-domain-status-name", "sites-domain-status-pill", "sites-domain-status-desc",
  "sites-domain-records", "sites-domain-records-title", "sites-domain-records-hint",
  "sites-domain-records-table", "sites-domain-records-type", "sites-domain-records-value",
  "sites-domain-records-empty", "sites-domain-instructions",
  "sites-domain-instructions-title", "sites-domain-instructions-list",
  "sites-domain-cname-box", "sites-domain-cname-label", "sites-domain-cname-value",
  "sites-domain-actions", "sites-domain-progress", "sites-domain-progress-track",
  "sites-domain-progress-bar", "sites-domain-progress-pct", "sites-domain-done",
  "sites-domain-done-icon", "sites-domain-done-title", "sites-domain-done-sub",
  "sites-domain-footer", "primary-button", "secondary-button", "icon-button",
  "vx-spin", "is-current", "is-done", "is-pending", "is-ok", "is-bad", "is-muted",
];

test("a configuração de domínio não usa classes componente", () => {
  for (const classe of legadas) {
    const re = new RegExp(`(?<![\\w-])${classe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    assert.equal(re.test(semDados), false, `classe componente ${classe} permaneceu`);
  }
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /!important/,
    /@apply/,
  ]) {
    const match = semDados.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  const hexEmClasse = [...semDados.matchAll(/className="[^"]*#[0-9a-fA-F]{3,8}/g)];
  assert.equal(hexEmClasse.length, 0, "hex direto em classe");
  for (const utility of [
    "grid min-w-0 gap-4 rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-lg",
    "flex flex-wrap items-start gap-3",
    "grid size-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-50",
    "grid grid-cols-2 gap-2 p-0 list-none max-md:grid-cols-4",
    "min-h-9 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800",
    "grid grid-cols-1 gap-3 max-md:grid-cols-2",
    "h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-700",
    "bg-blue-600 px-4 text-sm font-bold text-white",
  ]) {
    assert.ok(semDados.includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos de domínio permanecem intactos", () => {
  for (const hook of [
    'role="region"',
    'aria-label="Configuração de domínio próprio"',
    'aria-label="Etapas de configuração"',
    'aria-label="Passo 1 — Domínio"',
    'aria-label="Passo 2 — DNS e SSL"',
    'aria-label="Passo 3 — Deploy"',
    'aria-label="Passo 4 — Concluído"',
    'aria-label="Registros DNS"',
    'aria-invalid={!!domainError}',
    'aria-describedby="domain-error domain-hint"',
    'id="domain-error"',
    'id="domain-hint"',
    'role="progressbar"',
    "aria-valuenow={deployProgress}",
    "aria-valuemin={0}",
    "aria-valuemax={100}",
    'aria-label="Copiar valor do registro"',
    'aria-label="Copiar destino CNAME"',
    "onClick={checkAndSetDomain}",
    "onClick={deploy}",
    "onClick={retry}",
    "onClick={onClose}",
    "onClick={() => copyRecord(rec.value)}",
    "onClick={() => copyRecord(CNAME_TARGET)}",
  ]) {
    assert.ok(domain.includes(hook), `perdeu ${hook}`);
  }
  for (const dado of [
    'const domainStepState = flowStep === "domain" ? "current" : flowStep === "done" ? "done" : "pending";',
    'const statusPillClass = (variant: string) => statusPillVariantTw[variant] ?? statusPillVariantTw.muted;',
  ]) {
    assert.ok(domain.includes(dado), `perdeu o dado ${dado}`);
  }
});

test("as cores e escalas usadas pela fatia vêm do preset", () => {
  for (const trecho of [
    'blue: {',
    '50: "var(--primary-soft)"',
    '600: "var(--primary)"',
    '700: "var(--primary-strong)"',
    '950: "var(--primary-contrast)"',
    'slate: {',
    '950: "rgb(from var(--tx) r g b / <alpha-value>)"',
    'control: "var(--ctl)"',
    'pad: "var(--pad)"',
    '"brand-pad": "18px"',
    '@custom-variant ov-tablet (@media (max-width: 760px));',
  ]) {
    assert.ok(config.includes(trecho) || theme.includes(trecho), `o preset deve expor ${trecho}`);
  }
});
