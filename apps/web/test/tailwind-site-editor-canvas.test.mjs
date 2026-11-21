import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const files = {
  canvas: "src/app/sites/editor/canvas.tsx",
  shell: "src/app/sites/editor/editor-shell.tsx",
  inspector: "src/app/sites/editor/inspector.tsx",
};
const sources = Object.fromEntries(
  Object.entries(files).map(([name, file]) => [name, read(file)]),
);

const UTILITY_HINT =
  /(?:^|\s)(?:flex|grid|inline-flex|absolute|relative|fixed|block|hidden|peer|truncate|overflow|bg-|text-|border|rounded|p-|px-|py-|m-|mx-|my-|w-|h-|min-|max-|gap-|items-|justify|shadow|font-|cursor|opacity|disabled:|hover:|z-|animate-|transition|leading-)/;

function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  // Constantes e mapas Record<string,string> são strings literárias completas;
  // o guard precisa resolve-las para auditar o que realmente chega ao JSX.
  for (const literal of source.matchAll(/(["'])([^"'\n]*)\1/g)) {
    if (UTILITY_HINT.test(literal[2])) values.push(literal[2]);
  }
  return [...new Set(values)].join("\n");
}

const classes = Object.fromEntries(
  Object.entries(sources).map(([name, source]) => [name, classValues(source)]),
);

test("o canvas, o shell e o inspector nao usam classes componente legadas", () => {
  for (const [name, value] of Object.entries(classes)) {
    assert.doesNotMatch(value, /\bvx-[a-z][\w-]*/, `${name} ainda usa classe vx-*`);
    assert.doesNotMatch(value, /\bis-(?:active|disabled|error|ok|selected|dragging|drop-)/, `${name} ainda usa classe de estado legada`);
    assert.doesNotMatch(
      value,
      /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin)\b/,
      `${name} ainda usa classe de botao legada`,
    );
    assert.doesNotMatch(sources[name], /className="spin"/, `${name} ainda usa spin legado`);
  }
});

test("o canvas, o shell e o inspector usam so utilities do preset, sem remendos", () => {
  for (const [name, value] of Object.entries(classes)) {
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
    ]) {
      const match = value.match(forbidden);
      assert.equal(match, null, `${name}: remendo visual ${match?.[0]}`);
    }
  }

  for (const utility of [
    "flex h-full w-full min-h-0 flex-col overflow-hidden bg-surface-2 text-ink",
    "flex flex-1 flex-col items-center justify-center gap-2.5 text-center text-sm text-ink-secondary",
    "flex flex-none items-center justify-between gap-2 border-b border-line bg-surface px-2.5 py-1.5 text-ink",
    "inline-block h-3.5 w-3.5",
    "relative flex min-h-0 flex-1 justify-center overflow-auto bg-surface-2 p-3",
    "block h-full w-full min-h-90 rounded-square border-0 bg-surface-page shadow-token",
    "pointer-events-none absolute inset-0 z-10",
    "fixed inset-0 z-wizard h-dvh w-screen bg-surface-page text-ink",
    "relative flex min-h-0 flex-1 justify-center overflow-auto bg-surface-2",
    "block h-full w-full min-h-90 border-0 bg-surface-page shadow-token",
  ]) assert.ok(classes.canvas.includes(utility), `canvas perdeu a utility ${utility}`);

  for (const utility of [
    "flex h-dvh min-h-0 flex-col bg-surface-page font-ui text-ink",
    "flex h-14 flex-none items-center justify-between gap-2.5 border-b border-line bg-surface px-4",
    "flex min-w-0 items-center gap-2.5",
    "truncate text-xs text-ink-secondary",
    "truncate text-sm font-bold text-ink",
    "mr-1.5 text-xs font-semibold",
    "max-w-55 rounded-token-sm border border-line bg-surface px-2 py-1 text-body text-ink",
    "flex gap-1.5 rounded-token-sm border border-line bg-surface",
    "bg-blue-50 text-blue-600",
    "inline-flex h-9 w-9 items-center justify-center rounded-token-sm border border-line bg-surface text-ink hover:bg-hover",
    "inline-flex h-control items-center gap-2 rounded-token-sm border-0 bg-brand px-4 text-sm font-bold text-brand-contrast",
    "flex min-h-0 flex-1 overflow-hidden",
    "flex w-80 flex-none flex-col overflow-hidden border-r border-line bg-surface",
    "relative min-w-0 flex-1 overflow-hidden bg-surface-2",
    "flex w-85 flex-none flex-col overflow-hidden border-l border-line bg-surface",
    "border-emerald-600/40 bg-emerald-100 text-emerald-600",
    "border-red-600/40 bg-red-100 text-red-600",
    "border-amber-600/45 bg-amber-100",
  ]) assert.ok(classes.shell.includes(utility), `shell perdeu a utility ${utility}`);

  for (const utility of [
    "flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line",
    "inline-flex h-7.5 w-7.5 flex-none items-center justify-center rounded-token-sm border border-line bg-surface-2 text-ink-secondary",
    "m-0 truncate text-sm font-bold text-ink",
    "w-full rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted",
    "w-full min-h-15 resize-y rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink",
    "peer hidden",
    "relative h-5 w-10 rounded-full border border-line bg-line transition-control duration-control peer-checked:border-brand peer-checked:bg-brand",
    "flex flex-col items-center gap-2.5 p-10 text-center text-sm text-ink-secondary",
    "w-full min-h-18 resize-y rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink",
    "inline-flex items-center gap-1.5 rounded-token-sm bg-brand px-4 py-2 text-sm font-bold text-brand-contrast",
    "mx-4 mb-3 rounded-token-sm border border-emerald-600 bg-emerald-100 p-2 text-xs leading-relaxed text-emerald-600",
    "mx-4 mb-3 rounded-token-sm border border-red-600 bg-red-100 p-2 text-xs leading-relaxed text-red-600",
  ]) assert.ok(classes.inspector.includes(utility), `inspector perdeu a utility ${utility}`);
});

test("os contratos de testid, ids, ARIA e roles permanecem intactos", () => {
  const expectedTestIds = { canvas: [], shell: [], inspector: [] };
  for (const [name, source] of Object.entries(sources)) {
    const testIds = [...source.matchAll(/data-testid=["']([^"']+)["']/g)].map((match) => match[1]);
    assert.deepEqual(testIds, expectedTestIds[name], `${name} perdeu data-testid`);
  }

  const canvas = sources.canvas;
  for (const token of [
    "createPortal(", "srcDoc={frameHtml}", "postMessage", "onSelectNode", "onDragOver",
    "onDrop", "onNodeDragStart", "onDragEnd", 'title="canvas"',
    'sandbox="allow-same-origin allow-scripts"', 'aria-label="Preview do site"',
    "Preview do site em tela cheia (${device})",
    'aria-label={`Visualizar em', 'aria-label={isFullscreen ?',
    'aria-hidden="true"', "animate-spin", "onLoad={() => setReady(true)}",
  ]) assert.ok(canvas.includes(token), `canvas perdeu ${token}`);

  const shell = sources.shell;
  for (const token of [
    'role="application"', 'aria-label="Editor de sites Véxora"',
    'htmlFor="vx-editor-page"', 'id="vx-editor-page"',
    'aria-label="Fechar editor"', 'aria-label="Minimizar editor"',
    'role="group"', 'aria-label="Dispositivo de preview"',
    'aria-label={`Preview ${d}`}', 'role="status"', 'aria-live="polite"',
    "dirty ? ' • não salvo'", "readOnly", "loading", "saving", "publishing",
    "Salvando…", "Publicando…", "onSave", "onPublish", "onClose", "onMinimize",
    "onPropChange", "onAIChange", "aiFeedback", "interactionDisabled",
  ]) assert.ok(shell.includes(token), `shell perdeu ${token}`);

  const inspector = sources.inspector;
  for (const token of [
    'aria-label="Propriedades do bloco"', 'id="vexora-ai-prompt"',
    "role={aiFeedback.error ? 'alert' : 'status'}", 'aria-live="polite"',
    "aria-label={aiPanelOpen ? 'Fechar assistente de IA' : 'Abrir assistente de IA'}",
    "setAiPanelOpen(true)", "controlsDisabled", "readOnly", "aiBusy",
    "onPropChange(", "onStyleChange", "onAIChange(", "handleAiKeyDown",
    "selectedNode.id", "role=\"status\"", "aria-hidden=\"true\"",
  ]) assert.ok(inspector.includes(token), `inspector perdeu ${token}`);
});
