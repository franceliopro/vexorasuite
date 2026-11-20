import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const wizard = read("src/app/sites/wizard/wizard-shell.tsx");
const workspace = read("src/app/sites-workspace.tsx");

test("wizard sends the description as the prompt source", () => {
  assert.ok(wizard.includes("| { kind: 'ia'; prompt: string }"));
  assert.ok(wizard.includes("source = { kind: 'ia', prompt: prompt.trim() }"));
  assert.ok(wizard.includes("(origem === 'ia' && prompt.trim().length >= 3)"));
  assert.ok(wizard.includes("Criamos um rascunho premium com layout e textos sugeridos pela sua descrição."));
});

test("site creation forwards the prompt to the backend", () => {
  assert.ok(workspace.includes('if (source.kind === "ia" && source.prompt) body.prompt = source.prompt;'));
  assert.ok(workspace.includes("Rascunho premium com textos sugeridos pela sua descrição — revise no editor."));
});

test("wizard asks for an optional logo and forwards it to the backend", () => {
  assert.ok(wizard.includes("URL do logotipo (opcional)"));
  assert.ok(wizard.includes("Se deixar em branco, criamos um logotipo provisório"));
  assert.ok(wizard.includes("logoUrl: logoUrl.trim() || undefined"));
  assert.ok(workspace.includes("if (input.logoUrl) body.logoUrl = input.logoUrl;"));
});

test("editor exposes generated pages in the page selector", () => {
  const editorShell = read("src/app/sites/editor/editor-shell.tsx");
  assert.ok(editorShell.includes("Início (index)"));
  assert.ok(editorShell.includes("rascunho legal"));
  assert.ok(editorShell.includes("activeRoot ? [activeRoot] : []"));
});
