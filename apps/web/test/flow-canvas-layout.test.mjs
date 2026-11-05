import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = fs.readFileSync(path.join(root, "src/app/chatbot-workspace.tsx"), "utf8");
const design = fs.readFileSync(path.join(root, "src/app/vexora-design-system.css"), "utf8");

test("Flow Studio keeps the library at node width", () => {
  assert.match(design, /\.chatbot-workspace \.vx-flow-library \{\s*width: 260px;\s*min-width: 260px;/);
  assert.match(design, /grid-template-columns: 260px minmax\(0, 1fr\) minmax\(240px, 26%\) !important/);
  assert.match(design, /\.chatbot-workspace \.vx-flow-library button:not\(\.vx-panel-handle\)/);
});

test("fullscreen keeps the stage and scroll surface visible", () => {
  assert.match(design, /\.chatbot-workspace:fullscreen \.vx-flow-stage/);
  assert.match(design, /\.chatbot-workspace:fullscreen \.vx-flow-scroll/);
  assert.match(design, /\.chatbot-workspace:fullscreen \.vx-flow-board/);
  assert.match(workspace, /function toggleFullScreen\(\)\{setFullScreen\(value=>!value\)\}/);
  assert.doesNotMatch(workspace, /requestFullscreen/);
  assert.doesNotMatch(workspace, /setFullScreen\(false\);setEditorOpen\(false\)/);
});


test("canonical Flow Studio layout keeps the stage visible and fullscreen uncluttered", () => {
  assert.match(design, /\/\* Canonical Flow Studio layout\./);
  assert.match(design, /--vx-flow-library-width: 260px/);
  assert.match(design, /height: clamp\(800px, calc\(100dvh - 190px\), 1000px\) !important/);
  assert.match(design, /\.chatbot-workspace\.vx-flow-fullscreen > :not\(\.vx-flow-shell\)/);
  assert.match(design, /\.chatbot-workspace\.vx-flow-fullscreen \.vx-flow-shell[\s\S]*height: 100% !important/);
  assert.match(design, /\.chatbot-workspace \.vx-left-collapsed \.vx-flow-library > :not\(\.vx-panel-handle\)/);
});

test("Flow Studio refreshes transfer destinations on meaningful events, not a fixed timer", () => {
  assert.doesNotMatch(workspace, /setInterval\(refresh,30000\)/);
  assert.match(workspace, /window\.addEventListener\('vexora:team-updated',refresh\)/);
});


test("canvas viewport controls keep the flow inside the visible coordinate space", () => {
  assert.doesNotMatch(workspace, /transform:\`translate\\(\\$\\{canvasOrigin\\}px/);
  assert.doesNotMatch(workspace, /\\(minX\\+canvasOrigin\\)/);
  assert.doesNotMatch(workspace, /\\+canvasOrigin\\)\\*scale-canvas/);
});
