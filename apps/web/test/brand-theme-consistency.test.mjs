import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { brandTextColor } from "../src/lib/tenant-cache.ts";

const app = new URL("../src/app/", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, app), "utf8");
const lum = (h) => { const c = [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("brand text color always reaches AA for any brand color", () => {
  for (const brand of ["#7898F7", "#6258df", "#f5c518", "#0b3d2e", "#ff5a5f", "#ffffff", "#000000"]) {
    assert.ok(ratio(brandTextColor(brand), brand) >= 4.5, brand);
  }
});

test("a single applyBrandTheme owns the --primary tokens", () => {
  for (const f of ["page.tsx", "operations-settings.tsx"]) {
    const src = read(f);
    assert.match(src, /applyBrandTheme/, f);
    assert.doesNotMatch(src, /setProperty\("--primary/, `${f} must not set --primary directly`);
    assert.doesNotMatch(src, /luminance\s*>\s*0\.62/, `${f} must not use the approximate luminance cutoff`);
  }
});

test("secondary text tokens meet AA on their surfaces", () => {
  for (const [f, b] of [["#626982", "#ffffff"], ["#626982", "#f6f7fb"], ["#687087", "#ffffff"], ["#c0c6d7", "#191d28"], ["#a6a6c2", "#191d28"]]) assert.ok(ratio(f, b) >= 4.5, `${f} on ${b}`);
});
