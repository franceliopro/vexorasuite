import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const chatbot = read("src/app/chatbot-workspace.tsx");
const inbox = read("src/app/inbox-workspace.tsx");
const screens = [chatbot, inbox];

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
    for (const literal of match[2].matchAll(/(["'`])([^"'`]*)\1/g)) values.push(literal[2]);
    for (const template of match[2].matchAll(/`([^`]*)`/g)) {
      for (const token of template[1].split(/\s+/)) {
        if (/^[a-z][a-z0-9-]+$/i.test(token) && !constants.has(token)) values.push(token);
      }
    }
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
  }
  return values.join("\n");
}
const classes = screens.map(classValues).join("\n");

test("chatbot e inbox nao usam mais classes componente de botao legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin)\b/);
});

test("chatbot e inbox usam so utilities, sem remendos", () => {
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
    "min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-red-600",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos de chatbot e inbox permanecem intactos", () => {
  for (const token of [
    "loadCrmPipelines()", "loadAiAgents()", "loadRuntime()", "Tentar novamente", "chatbot-delete-block",
    "Gerar proposta", "Aplicar ao canvas", "Abrir no celular", "Reiniciar teste", "Guardar c\u00f3pia do fluxo atual",
  ]) assert.ok(chatbot.includes(token), `chatbot perdeu ${token}`);
  for (const token of [
    'data-testid="inbox-composer-input"', 'data-testid="composer-icon-button"',
    'data-testid="composer-tools"', 'data-testid="composer-mode-button"',
    'data-testid="emoji-category-tabs"', 'data-testid="quick-replies-popover"',
  ]) assert.ok(inbox.includes(token), `inbox perdeu ${token}`);
});
