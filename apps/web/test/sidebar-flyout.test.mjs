import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const design = fs.readFileSync(new URL("../src/app/vexora-design-system.css", import.meta.url), "utf8");

test("sidebar expands on desktop and collapses on mobile viewports", () => {
  assert.match(page, /window\.innerWidth < 981/);
  assert.match(page, /matchMedia\("\(max-width: 980px\)"\)/);
  assert.match(page, /mq\.addEventListener\("change", update\)/);
});

test("workspace families use persistent tabs instead of nested sidebar flyouts", () => {
  assert.doesNotMatch(page, /setSidebarCollapsed\(false\)/);
  assert.match(page, /persistent-module-tabs/);
  assert.match(page, /workspaceTabs/);
  assert.doesNotMatch(design, /sidebar\.sidebar-compact:hover[\s\S]*width: 258px/);
  assert.match(design, /nav-submenu[\s\S]*position:absolute/);
  assert.match(design, /width:68px!important/);
});
