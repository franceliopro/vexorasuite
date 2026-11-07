import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync(new URL("../src/app/vexora.css",import.meta.url),"utf8");

test("mobile navigation has larger touch targets while utilities stay compact",()=>{
  assert.match(css,/--dock-btn:62px/);
  assert.match(css,/\.mobile-bottom-nav\{[^}]*min-height:var\(--dock\)/);
  assert.match(css,/\.mobile-bottom-nav button\{[^}]*min-height:var\(--dock-btn\)/);
  assert.match(css,/\.mobile-bottom-nav button svg\{width:22px;height:22px\}/);
});

test("mobile workspace audit stacks dense layouts and protects narrow screens",()=>{
  assert.match(css,/\.metrics-grid,\.tasks-metrics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css,/\.page-content :is\(h1,h2,h3,h4,p,strong,small,label,button,a\)\{overflow-wrap:anywhere\}/);
  assert.match(css,/\.settings-catalog-grid,\.workflow-template-grid\{grid-template-columns:1fr\}/);
  assert.match(css,/\.vx-flow-shell\{grid-template-columns:1fr;height:auto\}/);
});
