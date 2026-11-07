import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = fs.readFileSync(path.join(root, "src/app/chatbot-workspace.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/app/vexora.css"), "utf8");

test("Flow Studio keeps the library at node width", () => {
  assert.match(css, /\.vx-flow-shell\{--vx-flow-library-width:260px/);
  assert.match(css, /grid-template-columns:var\(--vx-flow-library-width\) minmax\(0,1fr\) minmax\(240px,26%\)/);
  assert.match(css, /\.vx-flow-library button:not\(\.vx-panel-handle\)/);
});

test("fullscreen keeps the stage and scroll surface visible", () => {
  assert.match(css, /\.chatbot-workspace\.vx-flow-fullscreen \.vx-flow-shell\{height:100%\}/);
  assert.match(css, /\.chatbot-workspace\.vx-flow-fullscreen>:not\(\.vx-flow-shell\)\{display:none\}/);
  assert.match(css, /\.vx-flow-stage\{[^}]*overflow:hidden/);
  assert.match(css, /\.vx-flow-scroll\{[^}]*overflow:auto/);
  assert.match(workspace, /function toggleFullScreen\(\)\{setFullScreen\(value=>!value\)\}/);
  assert.doesNotMatch(workspace, /requestFullscreen/);
  assert.doesNotMatch(workspace, /setFullScreen\(false\);setEditorOpen\(false\)/);
});

test("collapsing the library keeps the panel handle reachable", () => {
  assert.match(css, /\.vx-left-collapsed \.vx-flow-library>:not\(\.vx-panel-handle\)/);
  assert.match(css, /\.vx-flow-shell\.vx-left-collapsed\{--vx-flow-library-width:44px\}/);
});

test("Flow Studio refreshes transfer destinations on meaningful events, not a fixed timer", () => {
  assert.doesNotMatch(workspace, /setInterval\(refresh,30000\)/);
  assert.match(workspace, /window\.addEventListener\('vexora:team-updated',refresh\)/);
});

test("canvas viewport controls keep the flow inside the visible coordinate space", () => {
  assert.doesNotMatch(workspace, /translate\(\$\{canvasOrigin\}px/);
  assert.doesNotMatch(workspace, /\(minX\+canvasOrigin\)/);
  assert.doesNotMatch(workspace, /\+canvasOrigin\)\*scale-canvas/);
});
