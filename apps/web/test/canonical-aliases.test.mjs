import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexoraCss = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("the canonical serial aliases match the semantic tokens", () => {
  for (const [alias, source] of [["page", "surface-page"], ["card", "surface-1"], ["ink", "text-primary"], ["muted", "text-muted"], ["line", "border-subtle"]]) {
    assert.match(vexoraCss, new RegExp(`--${alias}:\\s*var\\(--${source}\\)`), `${alias} must alias ${source}`);
  }
});
