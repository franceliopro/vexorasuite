import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  DEFAULT_TAILWIND_SELECTION,
  TAILWIND_PALETTE,
  TAILWIND_WEIGHTS,
  hexToTailwindSelection,
  tailwindHex,
} from "../src/lib/tailwind-palette.ts";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const vexora = read("src/app/vexora.css");
const theme = read("src/app/theme.css");
const picker = read("src/app/tailwind-color-picker.tsx");
const operations = read("src/app/operations-settings.tsx");
const page = read("src/app/page.tsx");
const brandTheme = read("src/lib/brand-theme.ts");
const config = read("tailwind.config.ts");
const layout = read("src/app/layout.tsx");

test("os tokens dark continuam slate e shell consome tokens, nunca blue-dark", () => {
  for (const token of [
    "--bg-base:#020617",
    "--bg-surface:#0F172A",
    "--bg-elevated:#1E293B",
    "--bg-hover:rgb(30 41 59 / .6)",
    "--border:#1E293B",
    "--border-light:#334155",
    "--text-main:#F8FAFC",
    "--text-muted:#94A3B8",
    "--text-dim:#64748B",
    "--bg:var(--bg-base)",
    "--s1:var(--bg-surface)",
    "--s2:var(--bg-elevated)",
    "--tx:var(--text-main)",
    "--sb-bg:var(--bg-surface)",
    "--sb-tx:var(--text-main)",
  ]) {
    assert.ok(vexora.includes(token), `o dark deve manter ${token}`);
  }

  /** Night Base (#050817/#0B1030/#121A44/#1C2552) é blue-dark: fora do runtime. */
  for (const blueDark of ["#050817", "#0B1030", "#121A44", "#1C2552", "#EEF1FF", "#9AA5CE"]) {
    assert.doesNotMatch(vexora, new RegExp(blueDark, "i"), `blue-dark ${blueDark} não pode entrar no tema`);
  }
  assert.doesNotMatch(layout, /vexora-night\.css/, "o tema Night Base não é importado");

  const sidebar = theme.match(/\.sidebar \{[\s\S]*?\n {2}\}/)?.[0] ?? "";
  assert.match(sidebar, /bg-indigo-950/, "sidebar usa o alias de --sb-bg");
  assert.match(sidebar, /text-indigo-50/, "sidebar usa o alias de --sb-tx");
  assert.match(config, /950:\s*"var\(--sb-bg\)"/);
  assert.match(config, /50:\s*"var\(--sb-tx\)"/);
  assert.match(theme, /body \{\s*@apply font-ui text-body text-slate-950[^}]*bg-zinc-50/);
  assert.match(config, /50:\s*"var\(--bg\)"/);
  const mainArea = theme.match(/\.main-area \{[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(mainArea, /#[0-9a-fA-F]{3,8}/, "main-area não define cor fixa");
  assert.equal(mainArea.includes("background"), false, "main-area herda --bg do body");

  /* Superfície única: a main pinta o fundo da página; .page-content e seus
     contêineres ficam transparentes nos três temas, inclusive no hover.
     Quem pinta fundo é o card, nunca um contêiner intermediário. */
  for (const rule of [
    ":root[data-theme=dark] .main-area{background-color:var(--bg-base)}",
    ".page-content{background:transparent}",
  ]) {
    assert.ok(vexora.includes(rule), `falta a regra de superfície: ${rule}`);
  }
  assert.ok(
    vexora.includes("--vx-core-topbar-bg:var(--bg-surface)"),
    "a topbar deve ser opaca na cor de superfície do tema",
  );
  assert.doesNotMatch(
    vexora,
    /\.topbar\{[^}]*background:color-mix\(in srgb,var\(--bg\) (?:84|92)%,transparent\)/,
    "a topbar não pode voltar a ser translúcida no mobile",
  );
  assert.doesNotMatch(vexora, /--layer-child|--layer-nested/, "não pode haver tokens de camada intermediária");
  assert.doesNotMatch(
    vexora,
    /\.page-content>\*\{background|\.page-content>\*:hover\{background|\.page-content>\*>\*\{background/,
    "contêineres intermediários não podem pintar fundo",
  );

  /* Existem três blocos `:root[data-theme=dark]` no legado. O último vence,
     então ele também precisa reaplicar os aliases — senão os tokens voltam
     aos tons antigos e a paleta nova só existe no primeiro bloco. */
  const section62 = vexora.slice(vexora.indexOf("/* ===== 62."));
  const lastDark = section62.slice(0, section62.indexOf("\n}", section62.indexOf(":root[data-theme=dark]{")));
  for (const token of ["--bg:var(--bg-base)", "--s1:var(--bg-surface)", "--s2:var(--bg-elevated)", "--tx:var(--text-main)", "--sb-bg:var(--bg-surface)"]) {
    assert.ok(lastDark.includes(token), `o bloco dark final reaplicou ${token}`);
  }
});

test("só a navegação da sidebar esconde a barra; as demais usam tokens", () => {
  const sideNav = theme.match(/\.side-nav \{[\s\S]*?\n {2}\}/)?.[0] ?? "";
  assert.match(sideNav, /scrollbar-width:\s*none/, "Firefox sem barra na nav");
  assert.match(theme, /\.side-nav::-webkit-scrollbar \{\s*display:\s*none;\s*\}/, "WebKit sem barra na nav");
  assert.match(vexora, /\.sidebar,\.side-nav,\.sidebar nav\{scrollbar-width:none\}/);
  assert.match(vexora, /\.sidebar::-webkit-scrollbar,\.side-nav::-webkit-scrollbar,\.sidebar nav::-webkit-scrollbar\{display:none\}/);
  assert.doesNotMatch(vexora, /\.sidebar \*::-webkit-scrollbar-thumb/, "a regra antiga vazava para toda a sidebar");

  for (const line of [...vexora.split(/\r?\n/), ...theme.split(/\r?\n/)]) {
    if (!/scrollbar-thumb|scrollbar-color/.test(line)) continue;
    assert.doesNotMatch(line, /background:\s*#[0-9a-fA-F]{3,8}/, `cor fixa em scrollbar: ${line}`);
    assert.doesNotMatch(line, /scrollbar-color:\s*#[0-9a-fA-F]{3,8}/, `cor fixa em scrollbar-color: ${line}`);
    if (/background:\s*var\(/.test(line)) {
      assert.match(line, /var\(--(?:sb-)?thumb\)/, `thumb deve seguir o tema: ${line}`);
    }
  }
  assert.match(brandTheme, /--sb-thumb.*color-mix/, "thumb da sidebar acompanha a cor escolhida");
});

test("o seletor usa somente paleta Tailwind, slider de peso e preview", () => {
  assert.deepEqual([...TAILWIND_WEIGHTS], [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
  for (const family of ["slate", "blue", "violet", "cyan", "fuchsia", "amber", "emerald", "rose", "orange"]) {
    assert.ok(TAILWIND_PALETTE.some((item) => item.family === family), `falta a família ${family}`);
  }
  assert.deepEqual(DEFAULT_TAILWIND_SELECTION, { family: "blue", weight: 700 });
  assert.equal(tailwindHex("blue", 700), "#1D4ED8", "azul comum é blue-700");
  assert.equal(tailwindHex("slate", 950), "#020617", "fundo slate do dark");
  assert.equal(tailwindHex("slate", 50), "#F8FAFC", "texto slate do dark");
  assert.deepEqual(hexToTailwindSelection("#020617"), { family: "slate", weight: 950, hex: "#020617" });
  assert.deepEqual(hexToTailwindSelection("#1D4ED8"), { family: "blue", weight: 700, hex: "#1D4ED8" });
  assert.deepEqual(hexToTailwindSelection("rgb(1,2,3)"), { family: "blue", weight: 700, hex: "#1D4ED8" });

  for (const source of [picker, operations, page]) {
    assert.doesNotMatch(source, /type="color"/, "entrada livre de cor não pode voltar");
    assert.doesNotMatch(source, /placeholder="#[0-9a-fA-F]/, "campo de texto HEX não pode voltar");
  }
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /!important/, /@apply/, /@tailwind base;/, /color-mix\(/]) {
    assert.doesNotMatch(picker, forbidden, `remendo visual no seletor: ${forbidden}`);
  }
  for (const hook of [
    "TAILWIND_PALETTE.map",
    "aria-pressed={active}",
    'type="range"',
    "min={0}",
    "max={TAILWIND_WEIGHTS.length - 1}",
    "step={1}",
    "value={selectedIndex}",
    "node.addEventListener(\"wheel\"",
    "if (event.key === \"ArrowRight\" || event.key === \"ArrowUp\")",
    "tailwindSelectionToHex(family, selected.weight)",
    "tailwindSelectionToHex(selected.family, weight)",
    "TailwindPalettePreview",
    'aria-label="Prévia em tempo real das cores"',
    "style={{ backgroundColor:",
  ]) {
    assert.ok(picker.includes(hook), `o seletor precisa de ${hook}`);
  }
  assert.ok(operations.includes("<TailwindColorPicker"));
  assert.ok(operations.includes("<TailwindPalettePreview"));
  assert.ok(page.includes("<TailwindColorPicker"));
  assert.ok(page.includes("<TailwindPalettePreview"));
});

test("os contratos de dados, ARIA e payloads HEX permanecem", () => {
  for (const hook of [
    'aria-label="Código HEX da cor"',
    'role="tablist"',
    'aria-label="Categorias de configuração"',
    'role="tabpanel"',
    'id={"settings-tab-"+key}',
    'id={"settings-panel-"+key}',
    'aria-label="Fechar erro"',
    'aria-label="Fechar aviso"',
    "onClick={()=>void saveBrand()}",
    "applyBrandAll(next,document.documentElement.dataset.theme)",
    "wcagRatio(brand.sidebarBackground",
    "JSON.stringify(brand)",
    'aria-label="Prévia das logos nos dois temas"',
  ]) {
    assert.ok(operations.includes(hook), `operações perderam ${hook}`);
  }
  for (const hook of [
    'data-testid="sidebar-color-popover"',
    'role="dialog"',
    'aria-labelledby="sidebar-color-title"',
    'aria-label="Fechar"',
    "setSidebarField(item.key, hex)",
    "saveSidebarColors",
    "sanitizeHex(sidebarDraft.sidebarBackground)",
    "JSON.stringify(payload)",
    "applyBrandAll(saved, currentTheme())",
    "Cor Modo Híbrido",
  ]) {
    assert.ok(page.includes(hook), `popover perdeu ${hook}`);
  }
  assert.match(brandTheme, /const HEX = \/\^#\[0-9a-fA-F\]\{6\}\$\//);
  assert.match(brandTheme, /export function sanitizeHex/);
  assert.match(operations, /Identidade visual salva para esta empresa\./);
  assert.match(page, /Restaurar padrão/);
});
