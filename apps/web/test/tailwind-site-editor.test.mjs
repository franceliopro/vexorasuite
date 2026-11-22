import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const editor = read("src/app/sites/site-editor-window.tsx");
const classes = editor;

test("o editor de sites nao usa mais classes componente de botao legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin|vx-editor-window)\b/);
  assert.doesNotMatch(editor, /className="spin"/);
});

test("o editor de sites usa so utilities, sem remendos", () => {
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
  assert.ok(editor.includes("border border-slate-700 bg-slate-800 px-4 text-sm font-bold text-slate-50"));
  assert.ok(editor.includes("animate-spin"));
  assert.ok(editor.includes("z-50"));
});

test("os contratos do editor de sites permanecem intactos", () => {
  for (const token of [
    '<details className={detailsClass}>', "Domínio, publicação e respostas",
    '<div className={editorWindowClass}', "readOnly={!canEdit}", "saving={saving}", "publishing={publishing}",
    "aiFeedback={aiMessage}", "Ver prévia temporária", "Voltar para Sites", "Vincular", "Verificar",
  ]) assert.ok(editor.includes(token), `editor perdeu ${token}`);
});
