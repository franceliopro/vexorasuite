import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/app/chatbot-workspace.tsx");
const start = workspace.indexOf("{aiCreateOpen?");
const end = workspace.indexOf("business-flow-library", start);
assert.notEqual(start, -1, "diálogo de IA não encontrado");
assert.notEqual(end, -1, "biblioteca de fluxos não encontrada");
const dialog = workspace.slice(start, end);

const constants = new Map();
for (const match of workspace.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
  constants.set(match[1], match[2]);
}

function classValues(source) {
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

const classes = classValues(dialog);

test("o diálogo de criação com IA não usa classes componente legadas", () => {
  assert.doesNotMatch(dialog, /className="(?:vx-dialog|chatbot-ai-|composer-ai-error)/);
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|chatbot-ai-|composer-ai-error$|primary-button$|secondary-button$|danger-button$|vx-spin$)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
});

test("o diálogo de IA usa só utilities, sem remendos", () => {
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
    "fixed inset-0 z-50 grid animate-dialog-scrim place-items-center bg-overlay",
    "w-full max-w-xl max-h-full flex-col animate-dialog-in overflow-hidden rounded-token-lg",
    "flex flex-none items-center gap-3 pr-10",
    "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain",
    "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2",
    "w-full rounded-token-sm border border-line bg-surface-2 px-3 py-2 text-body",
    "flex flex-none justify-end gap-2 border-t border-line pt-3",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o diálogo de IA preserva contratos, acessibilidade e ações", () => {
  for (const token of [
    'role="presentation"', 'role="dialog"', 'aria-modal="true"',
    'aria-labelledby="chatbot-ai-title"', 'id="chatbot-ai-title"',
    'aria-label="Fechar"', 'aria-pressed={aiDictating}',
    'htmlFor="chatbot-ai-request-input"', 'id="chatbot-ai-request-input"',
    'role="status"', 'role="alert"', "dictateAiRequest", "createFlowWithAi()",
    "Criar chatbot com IA", "Ditar", "Parar ditado", "Cancelar", "Criar fluxo",
    "Ctrl+Enter cria", "aiRequest.trim()", "setAiCreateOpen(false)",
  ]) {
    assert.ok(dialog.includes(token), `diálogo perdeu ${token}`);
  }
  assert.match(dialog, /onMouseDown=\{event=>\{if\(event\.target===event\.currentTarget&&!aiCreateBusy\)setAiCreateOpen\(false\)\}\}/);
});
