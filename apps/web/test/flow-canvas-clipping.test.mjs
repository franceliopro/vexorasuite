import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const design = fs.readFileSync(path.join(root, "src/app/vexora-design-system.css"), "utf8");

test("flow nodes are clipped to the stage and cannot paint over side rails", () => {
  assert.match(design, /\.chatbot-workspace \.vx-flow-shell \{[\s\S]*overflow: hidden !important/);
  assert.match(design, /\.chatbot-workspace \.vx-flow-stage \{[\s\S]*overflow: hidden !important/);
  assert.match(design, /\.chatbot-workspace \.vx-flow-scroll \{[\s\S]*overflow: auto !important/);
  assert.match(design, /clip-path: inset\(0\)/);
});
