import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
const vexoraCss = fs.readFileSync(path.join(root, "src/app/vexora.css"), "utf8");

test("page collapses the sidebar on narrow viewports", () => {
  assert.match(page, /window\.innerWidth < 981/);
  assert.match(page, /matchMedia\("\(max-width: 980px\)"\)/);
  assert.match(page, /mq\.addEventListener\("change", update\)/);
});

test("sidebar submenus keep an accessible path", () => {
  assert.match(vexoraCss, /\.nav-submenu/);
  assert.match(page, /persistent-module-tabs/);
  assert.match(page, /workspaceTabs/);
});
