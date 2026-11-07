import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const css = fs.readFileSync(path.join(root, "src/app/vexora.css"), "utf8");

test("flow nodes are clipped to the stage and cannot paint over side rails", () => {
  assert.match(css, /\.vx-flow-stage\{[^}]*overflow:hidden[^}]*clip-path:inset\(0\)/);
  assert.match(css, /\.vx-flow-wires\{[^}]*pointer-events:none/);
  assert.match(css, /\.vx-flow-scroll\{[^}]*overflow:auto/);
  assert.match(css, /\.vx-flow-shell\{[^}]*overflow:hidden/);
});
