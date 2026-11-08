import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const design=fs.readFileSync(new URL("../src/app/vexora-design-system.css",import.meta.url),"utf8");

test("mobile navigation has larger touch targets while utilities stay compact",()=>{
  // The dock height is token driven now; the token itself must still keep a 62px touch target.
  assert.match(design,/\.mobile-bottom-nav button\s*\{[\s\S]*min-height: var\(--mobile-nav-btn-h\)/);
  assert.match(design,/\.mobile-bottom-nav\s*\{[\s\S]*min-height: var\(--mobile-nav-h\)/);
  const tokens=fs.readFileSync(new URL("../src/app/globals.css",import.meta.url),"utf8");
  assert.match(tokens,/--mobile-nav-btn-h:\s*62px/);
  assert.match(design,/\.mobile-bottom-nav button svg\s*\{[\s\S]*width: 22px/);
  assert.match(design,/\.sidebar \.nav-item,[\s\S]*min-height: 50px/);
  assert.match(design,/\.sidebar \.sidebar-utilities \.sidebar-icon svg\s*\{[\s\S]*width: 16px/);
});

test("mobile workspace audit stacks dense layouts and protects narrow screens",()=>{
  assert.match(design,/\.settings-workspace \.settings-grid,\s*\.settings-workspace \.settings-grid > \*,\s*\.channels-inbox-grid,[\s\S]*grid-template-columns: 1fr !important/);
  assert.match(design,/\.page-content :is\(h1, h2, h3, h4, p, strong, small, label, button, a\)[\s\S]*overflow-wrap: anywhere/);
  assert.match(design,/\.workflow-template-grid\s*\{\s*grid-template-columns: 1fr/);
  assert.match(design,/\.topbar-company-button\s*\{\s*max-width: 96px/);
});
