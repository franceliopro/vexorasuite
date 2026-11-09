import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexoraCss = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("expanded sidebar text is readable on the graphite rail", () => {
  assert.match(vexoraCss, /--sb-bg:\s*#24262E/);
  assert.match(vexoraCss, /--sb-tx:\s*#ECEEF1/);
  assert.match(vexoraCss, /--sb-active:\s*var\(--primary\)/);
});
