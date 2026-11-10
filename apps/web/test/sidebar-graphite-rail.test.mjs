import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexoraCss = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("sidebar rail follows the current theme tokens (light clara, escuro #101317)", () => {
  // Light mode: near-white rail with dark, readable text
  assert.match(vexoraCss, /--sb-bg:\s*#FCFCFC/);
  assert.match(vexoraCss, /--sb-tx:\s*#1B1F1C/);
  // Dark / hybrid modes: graphite rail #101317 with light, readable text
  assert.match(vexoraCss, /:root\[data-theme=hybrid\][^}]*--sb-bg:\s*#101317/);
  assert.match(vexoraCss, /:root\[data-theme=dark\][\s\S]*?--sb-bg:\s*#101317/);
  assert.match(vexoraCss, /--sb-tx:\s*#E8ECF1/);
  // Branding is reserved for the selected/active state
  assert.match(vexoraCss, /--sb-active:\s*var\(--primary\)/);
});
