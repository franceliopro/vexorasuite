import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("compact sidebar shrinks the content offset without leaving a gap", () => {
  assert.match(css, /\.suite-app:has\(\.sidebar-compact\)\{--sb:76px\}/);
  assert.match(css, /\.main-area\{[^}]*margin-left:var\(--sb\)/);
  assert.match(css, /\.sidebar\{[^}]*width:var\(--sb\)/);
});
