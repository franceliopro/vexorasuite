import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THEME_BAR_COLORS, applyThemeColor } from "../src/lib/theme-color.ts";

const app = new URL("../src/app/", import.meta.url);
const ds = fs.readFileSync(new URL("vexora-design-system.css", app), "utf8");
const page = fs.readFileSync(new URL("page.tsx", app), "utf8");
const lum = (h) => { const c = [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const block = (sel) => { const i = ds.indexOf(`${sel} {`); assert.ok(i >= 0, sel); return ds.slice(i, ds.indexOf("\n}", i)); };
const token = (b, name) => b.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

test("focus ring is a neutral theme color, never a brand tint", () => {
  assert.match(ds, /--focus-ring:\s*var\(--text-primary\)/);
  assert.doesNotMatch(ds, /--focus-ring:\s*color-mix/);
  assert.doesNotMatch(ds, /:focus-visible\s*\{\s*outline:[^}]*var\(--primary\)/);
});

test("focus ring keeps 3:1 on the page and card surfaces of every theme", () => {
  const base = ds.slice(ds.indexOf(":root {"), ds.indexOf("\n}", ds.indexOf(":root {")));
  for (const [name, b] of [["light", block(':root[data-theme="light"]')], ["dark", block(':root[data-theme="dark"]')], ["hybrid", base]]) {
    const ink = token(b, "text-primary") ?? token(base, "text-primary");
    for (const surface of ["surface-page", "surface-1"]) {
      const bg = token(b, surface) ?? token(base, surface);
      assert.ok(ratio(ink, bg) >= 3, `${name} ${surface}`);
    }
  }
});

test("navigation focus ring uses the sidebar text color and stays visible", () => {
  assert.match(ds, /\.sidebar\s*\{\s*--focus-ring:\s*var\(--sidebar-text\)/);
  const base = ds.slice(ds.indexOf(":root {"), ds.indexOf("\n}", ds.indexOf(":root {")));
  for (const sel of [':root[data-theme="light"]', ':root[data-theme="dark"]', ':root[data-theme="hybrid"]']) {
    const b = block(sel);
    assert.ok(ratio(token(b, "sidebar-text") ?? token(base, "sidebar-text"), token(b, "sidebar-bg") ?? token(base, "sidebar-bg")) >= 3, sel);
  }
});

test("borderless search wrappers show focus themselves", () => {
  assert.match(ds, /:is\(\.search-box,\.crm-search,\.origin-search,\.profile-tag-editable\):focus-within\s*\{[^}]*outline:\s*2px solid var\(--focus-ring\)/);
});

test("status bar color matches each theme's page surface and follows the theme", () => {
  const base = ds.slice(ds.indexOf(":root {"), ds.indexOf("\n}", ds.indexOf(":root {")));
  assert.equal(THEME_BAR_COLORS.light, token(block(':root[data-theme="light"]'), "surface-page"));
  assert.equal(THEME_BAR_COLORS.dark, token(block(':root[data-theme="dark"]'), "surface-page"));
  assert.equal(THEME_BAR_COLORS.hybrid, token(base, "surface-page"));
  assert.match(page, /applyThemeColor\(theme\)/);
});

test("applyThemeColor updates existing meta tags and creates one when missing", () => {
  const made = [];
  const metas = [{ content: "x" }, { content: "y" }];
  const doc = { querySelectorAll: () => metas, createElement: () => ({}), head: { appendChild: (m) => made.push(m) } };
  applyThemeColor("dark", doc);
  assert.deepEqual(metas.map((m) => m.content), [THEME_BAR_COLORS.dark, THEME_BAR_COLORS.dark]);
  assert.equal(made.length, 0);
  applyThemeColor("light", { ...doc, querySelectorAll: () => [] });
  assert.equal(made[0].content, THEME_BAR_COLORS.light);
});
