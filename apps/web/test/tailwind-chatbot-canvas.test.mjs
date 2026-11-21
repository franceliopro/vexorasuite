import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const workspace = read("src/app/chatbot-workspace.tsx");
/* Sub-fatia do shell do canvas: da raiz do workspace até o inspetor. O
   conteúdo do inspetor e o diálogo de IA entram em sub-fátias separadas. */
const start = workspace.indexOf("export function ChatbotWorkspace");
const end = workspace.indexOf('<aside className={`${canvasPanel} ${canvasInspector}', start);
assert.notEqual(start, -1, "workspace não encontrado");
assert.notEqual(end, -1, "inspetor não encontrado");
const canvas = workspace.slice(start, end);

/** Literais de className e constantes TW referenciadas por className são classes.
    As constantes vivem antes do simulador, então são lidas do arquivo inteiro. */
function classValues(source, constantsSource) {
  const constants = new Map();
  for (const match of constantsSource.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
  }
  return values.join("\n");
}
const classes = classValues(canvas, workspace);
const tokens = classes.split(/\s+/).filter(Boolean);

const legacy = /^(vx-|chatbot-grid-|is-panning$|chatbot-workspace$|public-page-settings$)/;

test("o shell do canvas não usa classes componente legadas", () => {
  for (const token of tokens) {
    assert.equal(legacy.test(token), false, `classe legada no JSX: ${token}`);
  }
  assert.doesNotMatch(canvas, /\.vx-flow-/);
  assert.doesNotMatch(canvas, /\.vx-flow-input-port/);
  assert.doesNotMatch(canvas, /\.vx-flow-outputs/);
});

test("o shell do canvas usa só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  for (const utility of [
    "grid-cols-flow-shell",
    "h-flow-shell",
    "overflow-clip",
    "overflow-hidden",
    "overflow-visible",
    "touch-none",
    "select-none",
    "bg-flow-grid",
    "bg-flow-grid-size",
    "border-l-flow-tone-message",
    "z-flow-fullscreen",
    "z-flow-command",
    "z-flow-minimap",
    "w-flow-node",
    "w-flow-minimap",
    "shadow-flow-node",
    "shadow-flow-node-selected",
    "text-flow-panel-title",
    "tracking-flow-tight",
  ]) {
    assert.ok(workspace.includes(utility) || config.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os tokens do canvas", () => {
  for (const token of [
    '"flow-tone"',
    'message: "#2563eb"',
    'start: "#16a34a"',
    '"flow-minimap-bg": "var(--s2)"',
    '"flow-minimap-viewport": "var(--primary-soft)"',
    '"flow-grid": "radial-gradient(circle, var(--ln2) 0.75px, transparent 1px)"',
    '"flow-grid-legacy": "radial-gradient(var(--ln2) 1px, transparent 1px)"',
    '"flow-grid-size": "24px 24px"',
    '"flow-shell": "clamp(640px,calc(100dvh - 190px),1000px)"',
    '"flow-stage": "16px"',
    '"flow-node": "212px"',
    '"flow-node": "0 3px 16px -4px rgba(0,0,0,.18)"',
    'flow: "2"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
  assert.doesNotMatch(config, /color-mix\(/);
});

test("o shell do canvas preserva contratos, acessibilidade e estados", () => {
  for (const marker of [
    'data-flow-command-menu',
    'data-left-collapsed=',
    'data-right-collapsed=',
    'data-auto-hide=',
    'data-inspector-empty=',
    'data-panning=',
    'data-flow-board',
    'data-flow-node',
    'data-flow-start-node',
    'data-flow-input-port',
    'data-flow-outputs',
    'data-flow-node-head',
    'data-flow-panel-handle',
    'data-selected=',
    'data-connecting=',
    'aria-label="Editor visual do fluxo"',
    'aria-label="Mapa do fluxo"',
    'aria-label="Controles do canvas"',
    'role="navigation"',
    'setPointerCapture',
    'releasePointerCapture',
    'onPointerMove=',
    'onPointerUp=',
    'onLostPointerCapture=',
  ]) {
    assert.ok(canvas.includes(marker), `missing ${marker}`);
  }
  assert.doesNotMatch(canvas, /requestFullscreen/);
  assert.match(canvas, /function toggleFullScreen\(\)\s*\{\s*setFullScreen\(value\s*=>\s*!value\)\}/);
});
