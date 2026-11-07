import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("sidebar starts expanded and stays open while navigating", () => {
  assert.match(page, /const \[sidebarCollapsed, setSidebarCollapsed\] = useState\(false\)/);
  assert.doesNotMatch(page, /setSidebarCollapsed\(true\)/);
  assert.match(page, /className="sidebar-icon sidebar-collapse"/);
  assert.match(page, /aria-label=\{sidebarCollapsed \? "Expandir menu lateral" : "Recolher menu lateral"\}/);
});

test("the collapsed choice is remembered per browser", () => {
  assert.match(page, /localStorage\.getItem\("vexora:sidebar-collapsed"\)/);
  assert.match(page, /localStorage\.setItem\("vexora:sidebar-collapsed", String\(sidebarCollapsed\)\)/);
});

test("workspace families use persistent tabs and submenus expand inline", () => {
  assert.match(page, /persistent-module-tabs/);
  assert.match(page, /workspaceTabs/);
  assert.match(css, /\.nav-submenu\{[^}]*margin:2px 0 4px 26px/);
  assert.match(css, /\.sidebar\.sidebar-compact \.nav-submenu\{position:fixed/);
  assert.match(css, /\.sidebar\.sidebar-compact \.nav-item>span:not\(\.nav-glyph\)/);
});
