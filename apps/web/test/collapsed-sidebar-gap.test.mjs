import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

test("sidebar is collapsible on narrow viewports via a dedicated control", () => {
  assert.match(page, /sidebarCollapsed/);
  assert.match(page, /Recolher menu/);
});
