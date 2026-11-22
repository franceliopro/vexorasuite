import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const globals = read("src/app/vexora.css");
const editor = read("src/app/sites/editor/editor.css");
const preset = read("tailwind.config.ts");
const reminders = read("src/app/reminder-center.tsx");

test("reminders and alarms stay below fullscreen product windows", () => {
  const tokens = globals.match(/--z-reminder:\s*(\d+);--z-fullscreen-window:\s*(\d+);--z-fullscreen-dock:\s*(\d+);/);
  assert.ok(tokens, "layer tokens must be declared together in :root");
  const [, reminder, windowLayer, dock] = tokens.map(Number);
  assert.ok(reminder < windowLayer, `reminder (${reminder}) must be below the window (${windowLayer})`);
  assert.ok(windowLayer < dock, `window (${windowLayer}) must be below its dock (${dock})`);

  assert.match(preset, /reminder:\s*"var\(--z-reminder\)"/);
  assert.match(reminders, /\bz-reminder\b/);
  assert.doesNotMatch(reminders, /\breminder-center\b/);
  assert.match(globals, /\.alarm-overlay\s*\{[^}]*z-index:\s*var\(--z-reminder\)/);
  assert.doesNotMatch(globals, /z-index:\s*2147483647/);
});

test("sites wizard and editor use the fullscreen window layer", () => {
  assert.match(editor, /\.vx-editor-window\s*\{[^}]*z-index:\s*var\(--z-fullscreen-window/);
  assert.match(editor, /\.vx-editor-editor-dock\s*\{[^}]*z-index:\s*var\(--z-fullscreen-dock/);
  assert.match(editor, /\.vx-wizard\s*\{[^}]*z-index:\s*var\(--z-fullscreen-window/);
  assert.match(editor, /\.vx-wizard-dock\s*\{[^}]*z-index:\s*var\(--z-fullscreen-dock/);
});
