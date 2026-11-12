import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexoraCss = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("sidebar rail follows the current theme tokens (light clara, hibrido/escuro #060F26/#0E1530)", () => {
  // Light mode: near-white rail with dark, readable text
  assert.match(vexoraCss, /:root[\s\S]*?--sb-bg:\s*#FFFFFF/);
  assert.match(vexoraCss, /--sb-tx:\s*#1D2940/);
  // Hybrid mode: deep navy rail (Hope Diamond) with light, readable text
  assert.match(vexoraCss, /:root\[data-theme=hybrid\][^}]*--sb-bg:\s*#060F26/);
  // Dark mode: deep navy rail with light, readable text
  assert.match(vexoraCss, /:root\[data-theme=dark\][\s\S]*?--sb-bg:\s*#0E1530/);
  assert.match(vexoraCss, /--sb-tx:\s*#FAFCFF/);
  // Branding is reserved for the selected/active state
  assert.match(vexoraCss, /--sb-active:\s*var\(--primary\)/);
});
