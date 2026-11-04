import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appDir = new URL("../src/app/", import.meta.url);
const globalsCss = fs.readFileSync(new URL("globals.css", appDir), "utf8");
const designSystemCss = fs.readFileSync(new URL("vexora-design-system.css", appDir), "utf8");

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test("globals consumes the canonical surface, text, and border tokens", () => {
  assert.match(globalsCss, /--page:var\(--surface-page\)/);
  assert.match(globalsCss, /--card:var\(--surface-1\)/);
  assert.match(globalsCss, /--ink:var\(--text-primary\)/);
  assert.match(globalsCss, /--muted:var\(--text-muted\)/);
  assert.match(globalsCss, /--line:var\(--border-subtle\)/);
  assert.doesNotMatch(globalsCss, /--(?:page|card|ink|muted|line)\s*:\s*#[0-9a-f]{3,8}/i);
});

test("the design system owns button dimensions and semantic dark-mode surfaces", () => {
  for (const token of ["surface-1", "surface-2", "text-primary", "text-secondary", "text-muted", "border-subtle", "border-strong", "button-height", "button-radius"]) {
    assert.match(designSystemCss, new RegExp(`--${token}:`), `missing canonical token --${token}`);
  }
  assert.match(designSystemCss, /\.secondary-button[^}]*\.inbox-conversation[^}]*background-color:\s*var\(--surface-1\)/s);
  assert.match(designSystemCss, /\.message-bubble/);
  assert.match(designSystemCss, /\.primary-button,.secondary-button\)\s*\{[^}]*min-height:\s*var\(--button-height\)/s);
});

test("light and dark semantic text tokens meet WCAG AA for normal text", () => {
  const pairs = [
    ["#626982", "#ffffff", "light muted text"],
    ["#5f667d", "#ffffff", "light secondary text"],
    ["#c0c6d7", "#191d28", "dark secondary text"],
    ["#c0c6d7", "#202534", "dark text on input surface"],
  ];
  for (const [foreground, background, label] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${label} contrast is below 4.5:1`);
  }
});

test("known low-contrast legacy text colors are no longer used", () => {
  for (const color of ["#969bad", "#9a9eb0", "#8a8fa4", "#a0a4b4"]) {
    assert.doesNotMatch(designSystemCss, new RegExp(`(?:color|--(?:muted|text-muted))\\s*:\\s*${color}`, "i"), `${color} remains in the canonical text layer`);
  }
});
