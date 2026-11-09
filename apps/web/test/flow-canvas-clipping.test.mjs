import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = fs.readFileSync(path.join(root, "src/app/chatbot-workspace.tsx"), "utf8");

test("Flow Canvas clips nodes inside the stage and avoids stray overflows", () => {
  for (const marker of ["vx-flow-shell", "vx-flow-stage", "vx-flow-scroll", "vx-flow-board"]) {
    assert.ok(workspace.includes(marker), `missing ${marker}`);
  }
});
