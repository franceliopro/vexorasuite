import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
const vexoraCss = fs.readFileSync(path.join(root, "src/app/vexora.css"), "utf8");

test("sidebar collapses on narrow viewports and expands on desktop", () => {
  assert.match(page, /window\.innerWidth\s*<\s*981/);
  assert.match(page, /matchMedia\("\(max-width: 980px\)"\)/);
  assert.match(page, /mq\.addEventListener\("change", update\)/);
});

test("sidebar bordered rail has visible focus states", () => {
  assert.match(vexoraCss, /\.nav-item[\s\S]*?border-radius/);
});

test("sidebar exposes utility icons with accessible names", () => {
  for (const label of ["Recolher menu", "Instalar Véxora"]) {
    assert.ok(page.includes(label), `missing ${label}`);
  }
});
