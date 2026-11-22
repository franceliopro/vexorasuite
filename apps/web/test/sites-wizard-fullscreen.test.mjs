import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const wizard = read("src/app/sites/wizard/wizard-shell.tsx");
const editor = read("src/app/sites/site-editor-window.tsx");
const css = read("src/app/sites/editor/editor.css");

test("wizard uses a body portal so position: fixed escapes the animated workspace", () => {
  assert.match(wizard, /import\s*{[^}]*createPortal[^}]*}\s*from\s*["']react-dom["']/);
  assert.match(wizard, /createPortal\(content,\s*document\.body\)/);
});

test("wizard opens fullscreen and the header toggles a real window mode", () => {
  assert.ok(wizard.includes("type WizardMode = 'fullscreen' | 'window' | 'minimized'"));
  assert.ok(wizard.includes("useState<WizardMode>('fullscreen')"));
  assert.ok(wizard.includes("handleToggleFullscreen"));
  assert.ok(wizard.includes("aria-label={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}"));
});

test("wizard and editor body are large enough for the first step", () => {
  assert.match(css, /\.vx-wizard--window\s*\{[^}]*translate\(-50%,\s*-50%\)/);
  assert.match(css, /\.vx-wizard-body\s*>\s*\*\s*\{[^}]*max-width: 1040px/m);
  assert.match(css, /\.vx-wizard-step-title\s*\{[^}]*font-size: 1\.5rem/);
  assert.match(css, /\.vx-wizard-option\s*\{[^}]*min-height: 78px/);
});

test("editor window also escapes the animated workspace", () => {
  assert.match(editor, /import\s*{[^}]*createPortal[^}]*}\s*from\s*["']react-dom["']/);
  assert.match(editor, /createPortal\(\s*<div className=\{editorWindowTw\}/);
});
