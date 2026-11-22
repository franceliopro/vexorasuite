import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const inspector = read("src/app/sites/editor/style-inspector.tsx");

/* As utilities vivem em constantes literais; o guard resolve cada nome usado em
   className para inspecionar o valor real, não só o identificador. */
const constants = new Map();
for (const match of inspector.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g)) {
  constants.set(match[1], match[2]);
}

const classValues = [];
const push = (value) => classValues.push(...value.split(/\s+/).filter(Boolean));
for (const match of inspector.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{[\s\S]*?\})/g)) {
  if (match[1] !== undefined) push(match[1]);
  else if (match[2] !== undefined) push(match[2]);
  else {
    const expression = match[3] ?? "";
    for (const literal of expression.matchAll(/(["'])([^"']*)\1/g)) push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(expression)) push(value);
    }
  }
}
/* Expressões com template aninhado não são capturadas inteiras pelo extrator;
   todas as constantes entram na inspeção, como no guard da layer tree. */
const classes = [...classValues, ...constants.values()].join("\n");

test("o inspector de estilo não usa classes componente legadas", () => {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|ib-|rw-|ov-|auth-|alarm-|platform-admin-|vx-rich-|vx-post-|vx-gallery-|design-approval-)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
  for (const legacy of ["vx-style-", "vx-inspector-", "is-active"]) {
    assert.doesNotMatch(inspector, new RegExp(legacy.replace(/-/g, "\\-")));
  }
});

test("o inspector usa utilities literais do preset, sem remendos", () => {
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
    "flex flex-col gap-2 border-t border-line pt-2",
    "m-0 mb-1 text-xs leading-normal text-ink-secondary",
    "group overflow-hidden rounded-token-sm border border-line bg-surface",
    "flex cursor-pointer list-none select-none items-center gap-2 bg-surface-2 px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-ink-secondary",
    "flex flex-col gap-2.5 p-2.5",
    "grid grid-cols-2 gap-2",
    "grid grid-cols-4 gap-1.5",
    "flex gap-1",
    "flex-1 rounded-token-sm border border-line bg-surface px-0 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50",
    "border-brand bg-brand text-surface",
    "flex items-center gap-2",
    "min-w-8 text-right text-xs text-ink-secondary",
    "flex flex-col gap-1.5",
    "text-body font-bold text-ink-secondary",
    "flex flex-col gap-1",
    "w-full rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-50",
    "p-1.5 text-center text-xs",
    "size-7 shrink-0 cursor-pointer rounded-md border border-line bg-surface disabled:cursor-not-allowed disabled:opacity-50",
    "min-w-0 flex-1",
    "ml-auto text-sm leading-none text-ink-secondary group-open:hidden",
    "ml-auto hidden text-sm leading-none text-ink-secondary group-open:inline",
    "flex flex-wrap gap-1.5",
    "size-4 shrink-0 cursor-pointer rounded-full border border-line p-0 hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-brand disabled:cursor-not-allowed disabled:opacity-50",
    "flex flex-col gap-2",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
  for (const name of constants.keys()) {
    assert.match(inspector, new RegExp(`\\bconst\\s+${name}\\s*=\\s*'[^']+'`), `constante ${name} não é literal completa`);
  }
});

test("o inspector preserva estados, acessibilidade e contratos de edição", () => {
  for (const token of [
    "export function StyleInspector",
    "onStyleChange",
    "if (!disabled) onStyleChange(key, value);",
    "aria-label={`Alinhar à ${align}`}",
    'aria-label="Opacidade"',
    "aria-label={`Cor de ${label.toLowerCase()}`}",
    "aria-label={`Usar cor ${preset}`}",
    'type="range"',
    'min="0"',
    'max="1"',
    'step="0.05"',
    "open={defaultOpen}",
    "style={{ backgroundColor: preset }}",
    "onChange={(e) => set('opacity', e.target.value)}",
    "onClick={() => onChange(preset)}",
    "title={preset}",
    "title={align}",
    "Cores",
    "Espaçamento",
    "Dimensões",
    "Tipografia",
    "Layout e posição dos filhos",
    "Posicionamento",
    "Borda e sombra",
    "Efeitos",
    "Padding (interno)",
    "Margem (externa)",
    "parseNumber(style('opacity'), 1)",
    "hexOf(value)",
    "disabled={disabled}",
    "compact ? `${inputTw} ${compactInputTw}` : inputTw",
    "<TextInput compact",
    'className={`${inputTw} ${styleColorTextTw}`}',
    '<span aria-hidden="true" className={styleGroupExpandIconTw}>+</span>',
    '<span aria-hidden="true" className={styleGroupCollapseIconTw}>−</span>',
  ]) {
    assert.ok(inspector.includes(token), `inspector perdeu ${token}`);
  }
  assert.match(inspector, /const COLOR_PRESETS = \[[\s\S]*?'#0E7A5C'[\s\S]*?\];/);
  assert.match(inspector, /const TEXT_ALIGNS = \['left', 'center', 'right', 'justify'\] as const;/);
});
