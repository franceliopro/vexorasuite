import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = fs.readFileSync(path.join(root, "src/app/chatbot-workspace.tsx"), "utf8");

test("Flow Studio exposes the fullscreen toggle without browser fullscreen", () => {
  assert.match(workspace, /function toggleFullScreen\(\)\s*\{\s*setFullScreen\(value\s*=>\s*!value\)\}/);
  assert.doesNotMatch(workspace, /requestFullscreen/);
  assert.doesNotMatch(workspace, /setFullScreen\(false\);setEditorOpen\(false\)/);
});

test("Flow Studio keeps the studio sections and exported state", () => {
  for (const marker of ["toggleFullScreen", "vx-flow-shell", "vx-flow-library", "vx-flow-stage", "vx-flow-board"]) {
    assert.ok(workspace.includes(marker), `missing ${marker}`);
  }
});
