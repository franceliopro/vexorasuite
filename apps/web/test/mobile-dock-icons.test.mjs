import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexoraCss = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("mobile dock icons keep the touch target and the visible glyph size", () => {
  assert.match(vexoraCss, /\.mobile-bottom-nav button svg\s*\{[^}]*width:\s*22px/);
  assert.match(vexoraCss, /\.mobile-bottom-nav button\s*\{[^}]*min-height:\s*var\(--dock-btn\)/);
});
