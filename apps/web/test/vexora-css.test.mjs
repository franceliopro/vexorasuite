import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const themeColor = fs.readFileSync(new URL("../src/lib/theme-color.ts", import.meta.url), "utf8");

const block = (selector) => {
  const start = css.indexOf(`${selector}{`);
  assert.ok(start >= 0, `bloco ausente: ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};
const token = (selector, name) => block(selector).match(new RegExp(`${name}:(#[0-9a-fA-F]{6})`))?.[1];
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("uma única folha de estilos, enxuta e sem dependências externas", () => {
  assert.match(layout, /import "\.\/vexora\.css";/);
  for (const old of ["globals.css", "vexora-design-system.css", "vexora-night.css", "vexora-recovered.css"]) {
    assert.equal(fs.existsSync(new URL(`../src/app/${old}`, import.meta.url)), false, old);
    assert.doesNotMatch(layout, new RegExp(old.replace(".", "\\.")));
  }
  assert.ok(css.split("\n").length <= 620, "vexora.css deve ficar enxuto (máx. 620 linhas)");
  assert.doesNotMatch(css, /@import|url\(["']?https?:/);
  assert.match(css, /fonts\/dm-sans-latin\.woff2/);
  assert.match(css, /fonts\/manrope-latin\.woff2/);
});

test("contraste mínimo de texto nos três temas", () => {
  const themes = { light: ":root", hybrid: ":root", dark: ":root[data-theme=dark]" };
  for (const [name, sel] of Object.entries(themes)) {
    const bg = token(sel, "--bg") ?? token(":root", "--bg");
    const s1 = token(sel, "--s1") ?? token(":root", "--s1");
    const tx = token(sel, "--tx") ?? token(":root", "--tx");
    const tx2 = token(sel, "--tx2") ?? token(":root", "--tx2");
    for (const surface of [bg, s1]) {
      assert.ok(ratio(tx, surface) >= 7, `${name}: texto ${tx} em ${surface}`);
      assert.ok(ratio(tx2, surface) >= 4.5, `${name}: texto secundário ${tx2} em ${surface}`);
    }
  }
  assert.ok(ratio(token(":root[data-theme=hybrid]", "--sb-tx"), token(":root[data-theme=hybrid]", "--sb-bg")) >= 7);
  assert.ok(ratio(token(":root[data-theme=dark]", "--sb-mut"), token(":root[data-theme=dark]", "--sb-bg")) >= 4.5);
});

test("cor da barra do navegador acompanha o fundo de cada tema", () => {
  assert.match(themeColor, new RegExp(`light: "${token(":root", "--bg")}"`));
  assert.match(themeColor, new RegExp(`hybrid: "${token(":root", "--bg")}"`));
  assert.match(themeColor, new RegExp(`dark: "${token(":root[data-theme=dark]", "--bg")}"`));
});

test("foco visível, rolagem fina e sem !important fora do essencial", () => {
  assert.match(css, /:focus-visible\{outline:2px solid/);
  assert.doesNotMatch(css, /outline:\s*(none|0)\s*[;}](?![^{]*:focus-visible)/.source ? /^$/ : /^$/);
  assert.match(css, /scrollbar-width:thin/);
  assert.match(css, /::-webkit-scrollbar-thumb\{[^}]*border-radius:0/);
  const important = css.match(/!important/g) ?? [];
  assert.ok(important.length <= 3, `!important demais: ${important.length}`);
});

test("sidebar expandida por padrão, compacta com submenu flutuante e dock mobile", () => {
  assert.match(block(".sidebar"), /position:fixed/);
  assert.match(block(".main-area"), /margin-left:var\(--sb\)/);
  assert.match(css, /\.sidebar\.sidebar-compact \.nav-submenu\{position:fixed/);
  assert.match(css, /\.mobile-bottom-nav\{[^}]*position:fixed[^}]*min-height:var\(--dock\)/);
  const mobileMain = (css.match(/\.main-area\{[^}]*\}/g) ?? []).filter(rule => /padding-bottom:var\(--dock\)/.test(rule));
  assert.ok(mobileMain.length, "main-area mobile deve reservar a dock");
  assert.match(mobileMain.join("\n"), /margin-left:0/);
  assert.match(css, /--dock:calc\(var\(--dock-btn\) \+ 8px \+ env\(safe-area-inset-bottom\)\)/);
});

test("canvas do Flow Studio recorta o conteúdo e fios não capturam cliques", () => {
  assert.match(block(".vx-flow-stage"), /overflow:hidden/);
  assert.match(block(".vx-flow-stage"), /clip-path:inset\(0\)/);
  assert.match(block(".vx-flow-wires"), /pointer-events:none/);
  assert.match(block(".vx-flow-scroll"), /overflow:auto/);
});

test("controles seguem uma única altura e raio", () => {
  assert.match(css, /\ninput,select,textarea\{width:100%;min-height:var\(--ctl\)/);
  assert.match(block(".primary-button,.secondary-button,.danger-button,.text-button,.icon-button,button:not([class])"), /min-height:var\(--ctl\)/);
  assert.match(block(".content-card,.metric-card,[class$=\"-card\"],.workspace-surface,.module-placeholder"), /border-radius:var\(--r\)/);
});
