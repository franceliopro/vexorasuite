import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const windowSource = read("src/app/sites/site-editor-window.tsx");
const css = read("src/app/sites/editor/editor.css");

test("canvas selection overlay cannot inherit the global fixed modal overlay rule", () => {
  const rule = css.match(/\.vx-canvas-selection-overlay\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /position:\s*absolute/);
  assert.match(rule, /pointer-events:\s*none/);
  assert.match(rule, /background:\s*none/);
  assert.match(rule, /inset:\s*0/);
});

test("canvas fills the editor area instead of rendering a tiny iframe", () => {
  const canvas = css.match(/\.vx-canvas\s*\{([^}]*)\}/)?.[1] ?? "";
  const frame = css.match(/\.vx-canvas-frame\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(canvas, /height:\s*100%/);
  assert.match(canvas, /min-height:\s*0/);
  assert.match(frame, /height:\s*100%/);
  assert.match(frame, /min-height:\s*\d+px/);
});

test("domain and form responses are collapsed behind an expandable section", () => {
  assert.ok(windowSource.includes("<details className={detailsClass}>"));
  assert.ok(windowSource.includes("<summary className={detailsSummaryClass}>Domínio, publicação e respostas</summary>"));
  assert.match(css, /\.vx-editor-settings\s*\{[^}]*flex:\s*0\s+0\s+auto/);
});
