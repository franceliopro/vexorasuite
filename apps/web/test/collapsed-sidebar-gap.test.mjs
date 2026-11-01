import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const design = fs.readFileSync(path.join(root, "src/app/vexora-design-system.css"), "utf8");

test("compact sidebar does not add a right margin before the main content", () => {
  assert.match(design, /margin-left:var\(--desktop-sidebar-width\)!important/);
  assert.match(design, /width:calc\(100% - var\(--desktop-sidebar-width\))!important/);
});
