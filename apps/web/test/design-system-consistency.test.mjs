import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appDir = new URL("../src/app/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, appDir), "utf8");
const css = read("vexora.css");

const tsxFiles = fs.readdirSync(appDir).filter((name) => name.endsWith(".tsx"));

test("the mobile dock height is declared once and reused", () => {
  assert.match(css, /--dock-btn:62px/);
  assert.match(css, /--dock:calc\(var\(--dock-btn\) \+ 8px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.mobile-bottom-nav\{[^}]*min-height:var\(--dock\)/);
  assert.doesNotMatch(css, /\.mobile-bottom-nav\{[^}]*min-height:\d+px/);
});

test("content reserves the dock gutter exactly once", () => {
  const rules = css.match(/\.main-area\{[^}]*padding-bottom:var\(--dock\)[^}]*\}/g) ?? [];
  assert.equal(rules.length, 1, "the dock gutter must be reserved once, on .main-area");
  assert.doesNotMatch(css, /\.page-content\{[^}]*padding-bottom:calc\(7[46]px/);
});

test("the inbox thread fills the remaining viewport instead of using magic numbers", () => {
  assert.doesNotMatch(css, /100dvh - 58px - 62px/);
  assert.match(css, /\.inbox-workspace\.mobile-thread-open \.inbox-thread\{[^}]*height:100%/);
  const rules = css.match(/\.inbox-workspace\.mobile-thread-open \.inbox-thread[^{]*\{[^}]*\}/g) ?? [];
  for (const rule of rules) {
    assert.doesNotMatch(rule, /height:\s*calc\(100dvh/, `fixed viewport height found in: ${rule}`);
  }
});

test("the app chrome heights come from tokens", () => {
  assert.match(css, /--top:68px/);
  assert.match(css, /@media\(max-width:760px\)\{:root\{--top:58px\}\}/);
  assert.match(css, /\.topbar\{[^}]*height:var\(--top\)/);
  assert.doesNotMatch(css, /\.topbar\{[^}]*height:\d+px/);
});

test("fonts are self-hosted and build without network access", () => {
  const layout = read("layout.tsx");
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  assert.doesNotMatch(css, /@import\s+url\(["']?https?:/);

  // The brand faces must be declared from files we serve ourselves, not from a CDN.
  for (const face of ["DM Sans", "Manrope"]) {
    assert.match(
      css,
      new RegExp(`@font-face\\{font-family:'${face}';src:url\\('/fonts/[a-z-]+\\.woff2'\\)`),
      `missing local @font-face for ${face}`,
    );
  }
  assert.match(css, /font-display:swap/);

  // The token ladder keeps the brand family first and the system stack as fallback.
  assert.match(css, /--font-ui:"DM Sans",ui-sans-serif/);
  assert.match(css, /--font-display:"Manrope","DM Sans"/);

  // The referenced files must exist in the repository, otherwise the container serves a 404.
  const fontsDir = new URL("../public/fonts/", import.meta.url);
  for (const file of ["dm-sans-latin.woff2", "manrope-latin.woff2"]) {
    const font = fs.readFileSync(new URL(file, fontsDir));
    assert.equal(font.subarray(0, 4).toString("latin1"), "wOF2", `${file} is not a woff2 file`);
    assert.ok(font.length > 8000, `${file} looks truncated`);
  }

  for (const file of tsxFiles) {
    assert.doesNotMatch(read(file), /fonts\.googleapis\.com/, `${file} still loads Google Fonts at runtime`);
  }
});

test("one identity ships three themes with hybrid as the entry point", () => {
  const layout = read("layout.tsx");
  assert.match(layout, /data-theme="hybrid"/);
  assert.match(css, /:root\[data-theme=hybrid\]\{/);
  assert.match(css, /:root\[data-theme=dark\]\{/);
  for (const tokenName of ["--bg", "--s1", "--tx", "--tx2", "--ln", "--primary"]) {
    assert.ok(css.includes(`${tokenName}:`), `missing shared token ${tokenName}`);
  }
});

test("interface icons come from Lucide instead of typographic glyphs", () => {
  // Prose keeps its arrows ("Compartilhar → Adicionar"), but glyphs used as controls are forbidden.
  const forbidden = ["\u00d7", "\u2630", "\u2315", "\u21bb", "\u2039", "\u203a", "\u260f", "\u25eb", "\u2733", "\u2304", "\uff0b", "\u2197", "\u2199", "\u26f6"];
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

test("inbox conversation tags use their computed contrast color", () => {
  const inbox = read("inbox-workspace.tsx");
  assert.match(inbox, /color:tagForeground\(tag\.color\)/);
  assert.doesNotMatch(inbox, /backgroundColor:tag\.color,color:"#111827"/);
});

test("all contact tag surfaces use the shared contrast helper", () => {
  const inbox = read("inbox-workspace.tsx");
  const profile = read("contact-profile-panel.tsx");
  const helper = fs.readFileSync(new URL("../src/lib/tag-contrast.ts", import.meta.url), "utf8");
  assert.match(inbox, /tagForeground\(tag\.color\)/);
  assert.match(profile, /tagForeground\(tag\.color\)/);
  assert.match(helper, /export function tagForeground/);
  assert.doesNotMatch(inbox, /color:\s*["']#111827["']/);
  assert.doesNotMatch(profile, /color:\s*["']#111827["']/);
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
