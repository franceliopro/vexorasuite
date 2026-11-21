import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexoraCss = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("sidebar rail follows the current theme tokens (light clara, hibrido/escuro slate-950)", () => {
  // Light mode: near-white rail with dark, readable text
  assert.match(vexoraCss, /:root[\s\S]*?--sb-bg:\s*#FFFFFF/);
  assert.match(vexoraCss, /--sb-tx:\s*#1D2940/);
  // Hybrid mode: slate-950 rail with light, readable text; o ativo herda a marca
  assert.match(vexoraCss, /:root\[data-theme=hybrid\][^}]*--sb-bg:\s*#020617/);
  assert.match(vexoraCss, /:root\[data-theme=hybrid\][^}]*--sb-active:\s*var\(--primary\)/);
  // Dark mode: slate-950 rail with light, readable text
  assert.match(vexoraCss, /:root\[data-theme=dark\][\s\S]*?--sb-bg:\s*#020617/);
  assert.match(vexoraCss, /--sb-tx:\s*#F8FAFC/);
  // Branding is reserved for the selected/active state
  assert.match(vexoraCss, /--sb-active:\s*var\(--primary\)/);
});
