import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const design = fs.readFileSync(new URL("../src/app/vexora-design-system.css", import.meta.url), "utf8");

test("sidebar starts collapsed and collapses after selecting navigation", () => {
  assert.match(page, /useState\(true\)/);
  assert.match(page, /setSidebarCollapsed\(true\)/);
});

test("desktop sidebar flyout does not reflow the main workspace", () => {
  assert.match(design, /sidebar\.sidebar-collapsed:hover/);
  assert.match(design, /width: 258px/);
  assert.match(design, /position: fixed/);
});
