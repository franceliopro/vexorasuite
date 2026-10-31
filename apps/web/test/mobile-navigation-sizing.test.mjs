import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const design=fs.readFileSync(new URL("../src/app/vexora-design-system.css",import.meta.url),"utf8");

test("mobile navigation has larger touch targets while utilities stay compact",()=>{
  assert.match(design,/\.mobile-bottom-nav button\s*\{[\s\S]*min-height: 62px/);
  assert.match(design,/\.mobile-bottom-nav button svg\s*\{[\s\S]*width: 22px/);
  assert.match(design,/\.sidebar \.nav-item,[\s\S]*min-height: 50px/);
  assert.match(design,/\.sidebar \.sidebar-utilities \.sidebar-icon svg\s*\{[\s\S]*width: 16px/);
});
