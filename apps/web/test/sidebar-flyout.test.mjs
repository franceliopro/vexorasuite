import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const design = fs.readFileSync(new URL("../src/app/vexora-design-system.css", import.meta.url), "utf8");

test("sidebar starts collapsed and collapses after selecting navigation", () => {
  assert.match(page, /useState\(true\)/);
  assert.match(page, /setSidebarCollapsed\(true\)/);
});

test("workspace families use persistent tabs instead of nested sidebar flyouts", () => {
  assert.doesNotMatch(page, /setSidebarCollapsed\(false\)/);
  assert.match(page, /persistent-module-tabs/);
  assert.match(page, /workspaceTabs/);
  assert.doesNotMatch(design, /sidebar\.sidebar-compact:hover[\s\S]*width: 258px/);
  assert.match(design, /nav-submenu[\s\S]*position:absolute/);
  assert.match(design, /width:68px!important/);
});
