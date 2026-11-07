import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THEME_BAR_COLORS, applyThemeColor } from "../src/lib/theme-color.ts";

const app = new URL("../src/app/", import.meta.url);
const css = fs.readFileSync(new URL("vexora.css", app), "utf8");
const page = fs.readFileSync(new URL("page.tsx", app), "utf8");
const lum = (h) => { const c = [1, 3, 5].map((o) => parseInt(h.slice(o, o + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const block = (sel) => { const i = css.indexOf(`${sel}{`); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf("}", i)); };
const token = (b, name) => b.match(new RegExp(`--${name}:(#[0-9a-fA-F]{6})`))?.[1];

test("focus ring is a neutral theme color, never a brand tint", () => {
  assert.match(css, /--focus:var\(--tx\)/);
  assert.doesNotMatch(css, /--focus:var\(--primary\)/);
  assert.doesNotMatch(css, /:focus-visible\{outline:2px solid var\(--primary\)/);
});

test("focus ring keeps 3:1 on the page and card surfaces of every theme", () => {
  for (const [name, sel] of [["light", ":root"], ["dark", ":root[data-theme=dark]"]]) {
    const b = block(sel);
    const ink = token(b, "tx");
    for (const surface of ["bg", "s1"]) {
      assert.ok(ratio(ink, token(b, surface)) >= 3, `${name} ${surface}`);
    }
  }
});

test("navigation focus ring uses the sidebar text color and stays visible", () => {
  assert.match(block(".sidebar"), /--focus:var\(--sb-tx\)/);
  for (const sel of [":root", ":root[data-theme=hybrid]", ":root[data-theme=dark]"]) {
    const b = block(sel);
    assert.ok(ratio(token(b, "sb-tx"), token(b, "sb-bg")) >= 3, sel);
  }
});

test("borderless search wrappers show focus themselves", () => {
  assert.match(css, /:is\(\.search-box[^)]*\):focus-within\{[^}]*outline:2px solid var\(--focus\)/);
});

test("status bar color matches each theme's page surface and follows the theme", () => {
  assert.equal(THEME_BAR_COLORS.light.toLowerCase(), token(block(":root"), "bg").toLowerCase());
  assert.equal(THEME_BAR_COLORS.hybrid.toLowerCase(), token(block(":root"), "bg").toLowerCase());
  assert.equal(THEME_BAR_COLORS.dark.toLowerCase(), token(block(":root[data-theme=dark]"), "bg").toLowerCase());
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
