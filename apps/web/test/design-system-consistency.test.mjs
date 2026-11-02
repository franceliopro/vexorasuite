import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appDir = new URL("../src/app/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, appDir), "utf8");
const globalsCss = read("globals.css");
const designSystemCss = read("vexora-design-system.css");

const tsxFiles = fs.readdirSync(appDir).filter((name) => name.endsWith(".tsx"));

test("the mobile dock height is declared once and reused", () => {
  assert.match(globalsCss, /--mobile-nav-btn-h:\s*62px/);
  assert.match(globalsCss, /--mobile-nav-h:\s*calc\(var\(--mobile-nav-btn-h\) \+ 8px \+ env\(safe-area-inset-bottom\)\)/);
  // Both stylesheets must derive the dock height from the token instead of hard-coding pixels.
  assert.match(globalsCss, /\.mobile-bottom-nav\s*\{[^}]*min-height:\s*var\(--mobile-nav-h\)/);
  assert.match(designSystemCss, /\.mobile-bottom-nav\s*\{[^}]*min-height:\s*var\(--mobile-nav-h\)/);
  assert.doesNotMatch(globalsCss, /\.mobile-bottom-nav\s*\{[^}]*min-height:\s*\d+px/);
  assert.doesNotMatch(designSystemCss, /min-height:calc\((?:60|72)px \+ env\(safe-area-inset-bottom\)\)/);
});

test("content reserves the dock gutter exactly once", () => {
  assert.match(globalsCss, /\.main-area\s*\{[^}]*padding-bottom:\s*var\(--mobile-nav-h\)/);
  // A second reservation on the scroll container used to push the inbox composer behind the dock.
  assert.doesNotMatch(globalsCss, /\.page-content\s*\{[^}]*padding-bottom:calc\(7[46]px/);
  assert.doesNotMatch(designSystemCss, /\.page-content\{padding-bottom:calc\(76px/);
});

test("the inbox thread fills the remaining viewport instead of using magic numbers", () => {
  assert.doesNotMatch(designSystemCss, /100dvh - 58px - 62px/);
  const threadRules = globalsCss.match(/\.inbox-workspace\.mobile-thread-open \.inbox-thread[^{]*\{[^}]*\}/g) ?? [];
  assert.ok(threadRules.length >= 1, "expected a mobile thread rule");
  for (const rule of threadRules) {
    assert.doesNotMatch(rule, /height:\s*calc\(100dvh/, `fixed viewport height found in: ${rule}`);
  }
});

test("the app chrome heights come from tokens", () => {
  assert.match(globalsCss, /--topbar-h:\s*69px/);
  assert.match(globalsCss, /@media \(max-width:760px\)\{:root\{--topbar-h:59px\}\}/);
  assert.match(globalsCss, /\.topbar\{height:var\(--topbar-h\)/);
  assert.doesNotMatch(globalsCss, /\.topbar\{height:\d+px/);
});

test("fonts are self-hosted through next/font", () => {
  const layout = read("layout.tsx");
  assert.match(layout, /from "next\/font\/google"/);
  assert.match(layout, /variable:\s*"--font-sans-src"/);
  assert.match(layout, /variable:\s*"--font-display-src"/);
  assert.doesNotMatch(globalsCss, /fonts\.googleapis\.com/);
  assert.match(designSystemCss, /--font-ui:\s*var\(--font-sans-src\)/);
  assert.match(designSystemCss, /--font-display:\s*var\(--font-display-src\)/);
  for (const file of tsxFiles) {
    assert.doesNotMatch(read(file), /fonts\.googleapis\.com/, `${file} still loads Google Fonts at runtime`);
  }
});

test("interface icons come from Lucide instead of typographic glyphs", () => {
  // Prose keeps its arrows ("Compartilhar → Adicionar"), but glyphs used as controls are forbidden.
  const forbidden = ["\u00d7", "\u2630", "\u2315", "\u21bb", "\u2039", "\u203a", "\u260f", "\u25eb", "\u2733", "\u2304", "\uff0b", "\u2197"];
  for (const file of tsxFiles) {
    const source = read(file);
    for (const glyph of forbidden) {
      assert.ok(
        !source.includes(`>${glyph}<`) && !source.includes(`">${glyph}`) && !source.includes(`${glyph}</`),
        `${file} uses the typographic glyph ${glyph} as an icon`,
      );
    }
  }
});

test("every icon-only control keeps an accessible name", () => {
  for (const file of tsxFiles) {
    const source = read(file);
    const iconButtons = source.match(/<button[^>]*>\s*<[A-Z][A-Za-z0-9]*\s[^>]*aria-hidden="true"[^>]*\/>\s*<\/button>/g) ?? [];
    for (const button of iconButtons) {
      assert.match(button, /aria-label="[^"]+"|title="[^"]+"/, `${file}: icon button without accessible name -> ${button}`);
    }
  }
});
