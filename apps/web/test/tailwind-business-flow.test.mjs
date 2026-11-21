import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/app/chatbot-workspace.tsx");
const start = workspace.indexOf("data-business-flow-library");
assert.notEqual(start, -1, "biblioteca de fluxos não encontrada");
/* A biblioteca é o último bloco do componente. */
const library = workspace.slice(start);

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

const classes = classValues(library);

test("a biblioteca de fluxos não usa classes componente legadas", () => {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|ib-|rw-|ov-|chatbot-|business-flow-|content-card$|primary-button$|secondary-button$|danger-text$|danger-button$|icon-button$)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
});

test("a biblioteca usa utilities literais e tokens do preset, sem remendos", () => {
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
    "grid min-w-0 gap-3 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none",
    "flex flex-wrap items-center justify-between gap-3",
    "grid gap-3",
    "flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none",
    "flex flex-wrap items-center gap-2",
    "grid gap-1 text-body text-ink-secondary",
    "grid min-w-0 gap-2 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
  for (const name of [
    "flowLibraryTw",
    "flowLibraryHeadingTw",
    "flowLibraryGridTw",
    "flowLibraryCardTw",
    "flowLibraryActionsTw",
    "flowLibraryEmptyTw",
    "flowScopeTw",
  ]) {
    assert.match(workspace, new RegExp(`\\bconst\\s+${name}\\s*=\\s*"[^"]+"`), `constante ${name} não é literal completa`);
  }
});

test("a biblioteca preserva contratos, acessibilidade e ações", () => {
  for (const token of [
    'data-business-flow-library',
    "<h2>Fluxos salvos</h2>",
    "refreshLibrary()",
    "Editar no editor",
    "Usar este fluxo",
    "deleteLibrary(id)",
    "Nenhum fluxo salvo",
    "Guardar cópia do fluxo atual",
    "storeLibrary()",
    "Onde este fluxo será executado",
    'aria-label="Departamento de execução"',
    'aria-label="Atendente de execução"',
    "scopeDepartment",
    "scopeUser",
    "Publicar e pausar afetam somente o destino selecionado",
  ]) {
    assert.ok(library.includes(token), `biblioteca perdeu ${token}`);
  }
  assert.match(library, /className=\{flowLibraryTw\}/);
  assert.match(library, /className=\{flowScopeTw\}/);
});
