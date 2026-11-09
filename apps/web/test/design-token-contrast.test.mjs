import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vexora = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");
const lum = h => { const c = [1,3,5].map(o => parseInt(h.slice(o, o+2), 16)/255); const l = c.map(x => x <= .03928 ? x/12.92 : ((x+.055)/1.055) ** 2.4); return .2126*l[0] + .7152*l[1] + .0722*l[2]; };
const cr = (f,b) => { const x = Math.max(lum(f), lum(b)), y = Math.min(lum(f), lum(b)); return (x + .05)/(y + .05); };

test("canonical aliases chain to the canonical tokens", () => {
  for (const [x, y] of [["page","surface-page"],["card","surface-1"],["ink","text-primary"],["muted","text-muted"],["line","border-subtle"]]) {
    assert.match(vexora, new RegExp(`--${x}:var\\(--${y}\\)`));
  }
});

test("semantic surface and text tokens exist", () => {
  for (const x of ["surface-1", "surface-2", "text-primary", "text-secondary", "text-muted", "border-subtle", "border-strong"]) {
    assert.match(vexora, new RegExp(`--${x}:`));
  }
});

test("primary and secondary buttons are token-driven", () => {
  const primary = vexora.match(/\.primary-button\{[^}]+\}/)?.[0];
  assert.ok(primary, "primary-button block must exist");
  assert.match(primary, /background:\s*linear-gradient/);
  assert.match(primary, /color:\s*var\(--primary-contrast\)/);
  const shared = vexora.match(/\.primary-button,\.secondary-button,\.danger-button,\.text-button,\.icon-button,button:not\(\[class\]\)\{[^}]+\}/)?.[0];
  assert.ok(shared, "shared token-driven control block must exist");
  assert.match(shared, /border-radius:\s*var\(--r-sm\)/);
  assert.match(shared, /font-size:\s*13px/);
});

test("contrast keeps AA for readable foreground/background pairs", () => {
  for (const [f, b] of [["#626982","#ffffff"],["#5f667d","#ffffff"],["#c0c6d7","#191d28"],["#c0c6d7","#202534"]]) {
    assert.ok(cr(f, b) >= 4.5, `${f} on ${b} must be AA`);
  }
});

test("legacy raw hex names are absent from vexora.css", () => {
  for (const x of ["#969bad", "#9a9eb0", "#8a8fa4", "#a0a4b4"]) {
    assert.doesNotMatch(vexora, new RegExp(`(?:color|--(?:muted|text-muted))\\s*:\\s*${x}`, "i"));
  }
});
