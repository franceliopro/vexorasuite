import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appDir = new URL("../src/app/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, appDir), "utf8");
const vexoraCss = read("vexora.css");
const layoutTsx = read("layout.tsx");

const tsxFiles = fs.readdirSync(appDir).filter((name) => name.endsWith(".tsx"));

test("the mobile dock height is declared once and reused", () => {
  assert.match(vexoraCss, /--dock-btn:\s*62px/);
  assert.match(vexoraCss, /--dock:\s*calc\(var\(--dock-btn\)\s*\+\s*8px\s*\+\s*env\(safe-area-inset-bottom\)\)/);
  assert.match(vexoraCss, /\.mobile-bottom-nav\s*\{[^}]*min-height:\s*var\(--dock\)/);
  assert.match(vexoraCss, /\.mobile-bottom-nav button\s*\{[^}]*min-height:\s*var\(--dock-btn\)/);
  assert.doesNotMatch(vexoraCss, /\.mobile-bottom-nav button\s*\{[^}]*min-height:\s*\d+px/);
});

test("content reserves the dock gutter exactly once", () => {
  assert.match(vexoraCss, /\.main-area\{[^}]*margin-left:0;padding-bottom:var\(--dock\)/);
  assert.doesNotMatch(vexoraCss, /\.page-content\{padding-bottom:calc\(76px/);
});

test("the inbox thread fills the remaining viewport instead of magic numbers", () => {
  assert.doesNotMatch(vexoraCss, /100dvh - 58px - 62px/);
  assert.match(vexoraCss, /\.inbox-workspace\.mobile-thread-open \.inbox-thread\{[^}]*height:100%/);
});

test("the app shell height uses the --top token", () => {
  assert.match(vexoraCss, /--top:\s*56px/);
  assert.match(vexoraCss, /--top:\s*50px/); // mobile cap in @media
});

test("fonts are self-hosted and build without network access", () => {
  assert.doesNotMatch(layoutTsx, /next\/font\/google/);
  assert.doesNotMatch(layoutTsx, /fonts\.googleapis\.com/);
  assert.doesNotMatch(vexoraCss, /fonts\.googleapis\.com/);
  assert.doesNotMatch(vexoraCss, /@import\s+url\(["']?https?:/);

  for (const face of ["DM Sans", "Manrope"]) {
    assert.match(vexoraCss, new RegExp(`@font-face\\{font-family:'${face}';src:url\\('/fonts/[a-z-]+\\.woff2'\\)`), `missing local @font-face for ${face}`);
  }
  assert.match(vexoraCss, /font-display:swap/);

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

test("interface icons come from Lucide instead of typographic glyphs", () => {
  const forbidden = ["×", "☰", "⌕", "↻", "‹", "›", "☎", "◫", "✳", "⌄", "＋", "↗", "↙", "⛋"];
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

test("inbox conversation tags use the shared contrast helper", () => {
  const conversationList = read("conversation-list.tsx");
  assert.match(conversationList, /color:\s*tagForeground\(tag\.color\)/);
  assert.doesNotMatch(conversationList, /backgroundColor:\s*tag\.color,\s*color:\s*"#111827"/);
});

test("every contact tag surface uses the shared contrast helper", () => {
  const conversationList = read("conversation-list.tsx");
  const profile = read("contact-profile-panel.tsx");
  const helper = fs.readFileSync(new URL("../src/lib/tag-contrast.ts", import.meta.url), "utf8");
  assert.match(conversationList, /tagForeground\(tag\.color\)/);
  assert.match(profile, /tagForeground\(tag\.color\)/);
  assert.match(helper, /export function tagForeground/);
  assert.doesNotMatch(conversationList, /color:\s*["']#111827["']/);
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
