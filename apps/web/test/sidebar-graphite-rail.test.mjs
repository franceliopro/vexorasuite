import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexoraCss = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("sidebar rail follows the current theme tokens (light clara, hibrido blue-700, escuro slate-900)", () => {
  // Light mode: near-white rail with dark, readable text
  assert.match(vexoraCss, /:root[\s\S]*?--sb-bg:\s*#FFFFFF/);
  assert.match(vexoraCss, /--sb-tx:\s*#0F172A/);
  // Hybrid mode: blue-700 rail with light, readable text; o ativo herda a marca
  assert.match(vexoraCss, /:root\[data-theme=hybrid\][^}]*--sb-bg:\s*#1D4ED8/);
  assert.match(vexoraCss, /:root\[data-theme=hybrid\][^}]*--sb-active:\s*var\(--primary\)/);
  // Dark mode: a main é slate-950 e a sidebar/filhos diretos são slate-900
  assert.match(vexoraCss, /:root\[data-theme=dark\][\s\S]*?--bg-base:\s*#020617/);
  assert.match(vexoraCss, /:root\[data-theme=dark\][\s\S]*?--sb-bg:\s*var\(--bg-surface\)/);
  assert.match(vexoraCss, /--sb-tx:\s*var\(--text-main\)/);
  // Branding is reserved for the selected/active state
  assert.match(vexoraCss, /--sb-active:\s*var\(--primary\)/);
});
