import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const ficha = read("src/app/sites/components/FichaCliente.tsx");
const vexora = read("src/app/vexora.css");
const theme = read("src/app/theme.css");

function classValues(source) {
  const literals = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*"([^"]*)"\s*;/g)) {
    literals.set(match[1], match[2]);
  }

  const maps = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<[^;{]*,\s*string>\s*=\s*\{([\s\S]*?)\};/g)) {
    const entries = new Map();
    for (const entry of match[2].matchAll(/(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*"([^"]*)"/g)) {
      entries.set(entry[1] ?? entry[2], entry[3]);
    }
    maps.set(match[1], entries);
  }

  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const quoted of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(quoted[2]);
    for (const [name, value] of literals) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
    for (const [name, entries] of maps) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(...entries.values());
    }
  }
  return values.join("\n");
}

const classes = classValues(ficha);

test("a ficha nao usa classes componente decorativas nem CSS de remendo", () => {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-ficha-|fc-|ficha-)/.test(token),
      false,
      `classe decorativa no JSX: ${token}`,
    );
  }
  assert.doesNotMatch(ficha, /vx-ficha-/);
  assert.doesNotMatch(ficha, /ficha-cliente\.css/);
  assert.doesNotMatch(vexora, /\.vx-ficha-/);
});

test("a ficha usa so utilities literais do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /\b(?:gray|slate|zinc|indigo|blue|green|amber|red)-\d{2,3}\b/,
    /\b(?:bg|text|border)-(?:white|black)\b/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }

  for (const utility of [
    "fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6",
    "absolute inset-0 bg-overlay backdrop-blur-sm transition-opacity",
    "relative z-10 flex max-h-ficha w-full max-w-md flex-col overflow-hidden rounded-token-xl border border-line bg-surface shadow-token-lg",
    "flex items-center justify-between gap-3 border-b border-line p-5",
    "flex border-b border-line bg-surface-2",
    "flex-1 overflow-y-auto p-4",
    "flex items-center justify-between gap-2 border-t border-line bg-surface-2 p-4",
    "inline-flex items-center justify-center gap-1.5 rounded-token-sm bg-brand px-4 py-2 text-sm font-semibold text-brand-contrast shadow-token transition-all hover:bg-brand-strong active:scale-95",
    "rounded-token-lg border border-line bg-surface-2 p-4",
    "mb-2 text-2xs font-bold uppercase tracking-wider text-ink-muted",
    "w-full bg-transparent text-sm text-ink outline-hidden",
    "rounded-full border border-success-soft bg-success-soft px-2 py-1 text-2xs font-semibold text-success",
    "flex h-9 w-9 items-center justify-center rounded-token-sm bg-brand-soft text-brand",
    "flex h-9 w-9 items-center justify-center rounded-token-sm bg-surface-3 text-ink-muted",
    "rounded-token-sm border border-warning-soft bg-warning-soft p-4",
    "fixed inset-0 z-wizard flex items-center justify-center bg-overlay-soft p-4 backdrop-blur-sm",
    "grid grid-cols-1 gap-4 md:grid-cols-2",
    "rounded-sm accent-brand",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos, callbacks e responsividade da ficha permanecem intactos", () => {
  assert.doesNotMatch(ficha, /\bdata-testid\b|\baria-|\brole=|\sid=/);

  for (const token of [
    '(["dados", "contato", "historico", "mais"] as TabId[])',
    "setActiveTab(tab)",
    "setMoreOpen(false)",
    "onClose?.()",
    "onSave?.({ ...c })",
    "onFinish?.()",
    "setWizardOpen(true)",
    "setTermsChecked(!termsChecked)",
    "handleWizardNext",
    "handleWizardBack",
    "handleFinish",
    "Concluir ficha",
    "Concluir edição",
    "Li e confirmo que as informações estão corretas.",
    "Ficha concluída",
    "Adicione outros canais quando precisar.",
    "Campos personalizados",
    "Notificações e idioma",
    "Fechar",
    "Próximo",
    "Voltar",
    "Finalizar",
  ]) {
    assert.ok(ficha.includes(token), `a ficha perdeu ${token}`);
  }

  for (const variant of ["ov-laptop", "ib-narrow", "rw-mobile"]) {
    assert.ok(theme.includes(`@custom-variant ${variant}`), `theme perdeu ${variant}`);
  }
});

test("os tokens derivados continuam disponiveis para o preset", () => {
  for (const token of [
    "--vx-overlay:color-mix(in srgb,var(--tx) 34%,transparent)",
    "--vx-overlay-soft:color-mix(in srgb,var(--tx) 20%,transparent)",
    "--vx-ok-soft:color-mix(in srgb,var(--ok) 12%,var(--s1))",
    "--vx-warn-soft:color-mix(in srgb,var(--warn) 12%,var(--s1))",
    "--bg:var(--bg-base);--s1:var(--bg-surface);--s2:var(--bg-elevated)",
    "--sb-bg:var(--bg-surface)",
  ]) {
    assert.ok(vexora.includes(token), `o tema perdeu ${token}`);
  }
});
