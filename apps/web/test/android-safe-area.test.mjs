import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const layout = read("src/app/layout.tsx");
const css = read("src/app/vexora.css");
const page = read("src/app/page.tsx");

test("o shell Android marca a página para aplicar área segura", () => {
  assert.match(layout, /viewportFit: "cover"/);
  assert.ok(layout.includes('window.__TAURI_INTERNALS__&&/Android/i.test(navigator.userAgent)'));
  assert.ok(layout.includes('document.documentElement.dataset.nativeAndroid="true"'));
  assert.ok(layout.includes('addEventListener("load",mark,{once:true})'));
});

test("o topbar de todas as telas e a navegação inferior desviam das barras do Android", () => {
  for (const marker of [
    "html[data-native-android]",
    "--vx-system-top: max(env(safe-area-inset-top), 40px)",
    "--vx-system-bottom: max(env(safe-area-inset-bottom), 32px)",
    "--top: calc(48px + var(--vx-system-top))",
    "html[data-native-android] .topbar",
    "height: var(--top) !important",
    "min-height: var(--top) !important",
    "padding-top: var(--vx-system-top) !important",
    'html[data-native-android]:has([data-testid="ov-dock"])',
    "--dock: calc(var(--dock-btn) + 8px + var(--vx-system-bottom))",
    ".mobile-bottom-nav--overview{justify-content:center!important;grid-auto-columns:minmax(84px,120px)!important}",
  ]) {
    assert.ok(css.includes(marker), `perdeu ${marker}`);
  }
});

test("a Visão geral usa o menu inferior compartilhado com apenas Conversa", () => {
  assert.ok(page.includes('dock:"mobile-bottom-nav mobile-bottom-nav--overview"'));
  assert.doesNotMatch(page, /max-md:pb-2/);
  assert.match(page, /<span>Conversa<\/span><\/button>\s*\{active !== "Visão geral" && <>/);
});
