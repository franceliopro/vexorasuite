import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

test("only one sidebar group stays open and the collapse control is explicit", () => {
  assert.match(page, /className="sidebar-icon sidebar-collapse"/);
  // Opening a group replaces the previous one instead of stacking menus.
  assert.match(page, /setExpandedModules\(\(current\) => current\.includes\(item\.label\) \? \[\] : \[item\.label\]\)/);
  // Navigating must not silently collapse the sidebar anymore.
  assert.doesNotMatch(page, /setSidebarCollapsed\(true\)/);
});
