import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

test("sidebar has no manual collapse button and child navigation closes groups", () => {
  assert.doesNotMatch(page, /sidebar-collapse/);
  assert.match(page, /setExpandedModules\(\[\]\);setSidebarCollapsed\(true\)/);
  assert.doesNotMatch(page, /const parent=navigation\.flatMap/);
});
