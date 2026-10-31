import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const design = fs.readFileSync(path.join(root, "src/app/vexora-design-system.css"), "utf8");

test("sidebar utility icons stay horizontal and compact", () => {
  assert.match(design, /\.sidebar\.sidebar-compact \.sidebar-utilities[\s\S]*flex-direction: column !important/);
  assert.match(design, /sidebar-compact:hover \.sidebar-utilities[\s\S]*flex-direction: row !important/);
  assert.match(design, /\.sidebar\.sidebar-compact \.sidebar-icon svg[\s\S]*width: 20px/);
  assert.match(design, /\.sidebar \.nav-item,[\s\S]*padding-block: 5px !important/);
});
