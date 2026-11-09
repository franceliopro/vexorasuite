import test from "node:test";
import assert from "node:assert/strict";
import { THEME_BAR_COLORS, applyThemeColor } from "../src/lib/theme-color.ts";

test("THEME_BAR_COLORS exposes the three themes", () => {
  for (const name of ["light", "dark", "hybrid"]) {
    assert.ok(typeof THEME_BAR_COLORS[name] === "string" && THEME_BAR_COLORS[name].startsWith("#"), `${name} bar color`);
  }
});

test("applyThemeColor updates existing meta tags and creates one when missing", () => {
  const made = [];
  const metas = [{ content: "x" }, { content: "y" }];
  const doc = { querySelectorAll: () => metas, createElement: () => ({}), head: { appendChild: (m) => made.push(m) } };
  applyThemeColor("dark", doc);
  assert.deepEqual(metas.map((m) => m.content), [THEME_BAR_COLORS.dark, THEME_BAR_COLORS.dark]);
  assert.equal(made.length, 0);
  const made2 = [];
  applyThemeColor("light", { ...doc, querySelectorAll: () => [], createElement: () => ({}), head: { appendChild: (m) => made2.push(m) } });
  assert.equal(made2[0].content, THEME_BAR_COLORS.light);
});
