import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const layout = read("src/app/layout.tsx");
const css = read("src/app/vexora.css");

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
    'html[data-native-android] [data-testid="ov-dock"]',
    "padding-bottom: var(--vx-system-bottom) !important",
    'html[data-native-android]:has([data-testid="ov-dock"]) .main-area',
  ]) {
    assert.ok(css.includes(marker), `perdeu ${marker}`);
  }
});
