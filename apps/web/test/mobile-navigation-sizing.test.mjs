import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexora = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("dock touch targets are driven by tokens and reserved once", () => {
  assert.match(vexora, /--dock-btn:\s*62px/);
  assert.match(vexora, /--dock:\s*calc\(var\(--dock-btn\)\s*\+\s*8px\s*\+\s*env\(safe-area-inset-bottom\)\)/);
  assert.match(vexora, /\.mobile-bottom-nav\s*\{[^}]*min-height:\s*var\(--dock\)/);
  assert.match(vexora, /\.mobile-bottom-nav button\s*\{[^}]*min-height:\s*var\(--dock-btn\)/);
  assert.match(vexora, /\.mobile-bottom-nav button svg\s*\{[^}]*width:\s*22px/);
});

test("dense page content stacks on narrow screens", () => {
  assert.match(vexora, /\.settings-catalog-grid,\.workflow-template-grid\{grid-template-columns:1fr\}/);
  assert.match(vexora, /\.page-content :is\(h1,h2,h3,h4,p,strong,small,label,button,a\)\{overflow-wrap:anywhere\}/);
});
