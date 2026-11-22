import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const config = read("tailwind.config.ts");
const theme = read("src/app/theme.css");
const legacy = read("src/app/vexora.css");
const layout = read("src/app/layout.tsx");
const postcss = read("postcss.config.js");

test("o core global usa Tailwind v4 com Preflight oficial, sem arbitrários ou hex", () => {
  assert.match(theme, /@import "tailwindcss\/theme\.css" layer\(theme\);/);
  assert.match(theme, /@import "tailwindcss\/preflight\.css" layer\(base\);/);
  assert.match(theme, /@import "tailwindcss\/utilities\.css" layer\(utilities\);/);
  assert.match(theme, /@config "\.\.\/\.\.\/tailwind\.config\.ts";/);
  assert.doesNotMatch(theme, /@tailwind base;/);
  assert.doesNotMatch(config, /corePlugins/);
  assert.match(postcss, /"@tailwindcss\/postcss"/);
  assert.doesNotMatch(postcss, /tailwindcss:/);

  const semComentarios = theme.replace(/\/\*[\s\S]*?\*\//g, "");

  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
  ]) {
    const match = semComentarios.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }

  assert.match(theme, /\[hidden\]\s*\{\s*@apply hidden;\s*\}/);
  // Em v4 [hidden] fica fora de camada: CSS não em camada vence utilities em camada.
  const baseBlock = theme.match(/@layer base \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.doesNotMatch(baseBlock, /\[hidden\]/);
  const componentsBlock = theme.match(/@layer components \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.doesNotMatch(componentsBlock, /\[hidden\]/);
});

test("os três temas continuam sendo a fonte dos tokens", () => {
  assert.match(legacy, /:root\[data-theme=hybrid\]/);
  assert.match(legacy, /:root\[data-theme=dark\]/);
  assert.match(legacy, /color-scheme:light/);
  assert.match(legacy, /color-scheme:dark/);
  assert.match(layout, /data-theme="hybrid"/);
  assert.match(layout, /localStorage\.getItem\("vexora:theme"\)/);
});

test("a marca padrão é blue-700 e o escuro usa slate", () => {
  for (const file of [
    "src/app/vexora.css",
    "src/app/page.tsx",
    "src/app/operations-settings.tsx",
    "../api/src/ai/design-approvals.controller.ts",
    "../api/src/ai/public-design-approvals.controller.ts",
  ]) {
    const source = read(file);
    assert.match(source, /#1D4ED8/, `${file} deve usar blue-700 como padrão`);
    assert.doesNotMatch(source, /#2E7CF6/i, `${file} ainda usa a cor antiga`);
  }

  const dark = legacy.match(/:root\[data-theme=dark\][\s\S]*?\n\}/)?.[0] ?? "";
  for (const token of [
    "--bg-base:#020617", "--bg-surface:#0F172A", "--bg-elevated:#1E293B",
    "--text-main:#F8FAFC", "--border-light:#334155",
    "--bg:var(--bg-base)", "--s1:var(--bg-surface)", "--s2:var(--bg-elevated)",
    "--sb-bg:var(--bg-surface)",
  ]) {
    assert.ok(dark.includes(token), `o tema escuro deve mapear ${token} (slate)`);
  }
  assert.match(legacy, /--primary:#1D4ED8/);
  assert.match(legacy, /--sb-active:var\(--primary\)/);
});

test("h1 a h6, p e hr são definidos na camada tokenizada", () => {
  for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6", "p", "hr"]) {
    assert.match(theme, new RegExp(`(^|\\n)${tag}\\s*\\{`, "m"), `falta ${tag} no core`);
  }
  for (const token of [
    "text-body",
    "text-h1",
    "text-h2",
    "text-h3",
    "text-h4",
    "text-h5",
    "text-h6",
    "bg-vx-page",
    "bg-zinc-50",
    "text-slate-950",
    "border-gray-200",
    "outline-blue-600",
    "font-ui",
  ]) {
    assert.ok(
      theme.includes(token) || config.includes(token.replace(/-/g, "")),
      `o core deve usar ${token}`,
    );
  }
});

test("formulários, controles e estados ARIA têm base tokenizada", () => {
  for (const selector of [
    "form",
    "fieldset",
    "legend",
    "label",
    "input,",
    "select",
    "textarea",
    "select option,",
    "optgroup",
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="range"]',
    'input[type="file"]',
    'input[type="color"]',
    "progress",
    "meter",
    "output",
    '[role="button"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="menuitem"]',
    '[role="switch"]',
    '[aria-invalid="true"]',
    '[aria-disabled="true"]',
    '[aria-busy="true"]',
  ]) {
    assert.ok(theme.includes(selector), `falta a base de ${selector}`);
  }
  for (const token of [
    "placeholder:text-slate-400",
    "focus:border-blue-600",
    "accent-blue-600",
    "disabled:cursor-not-allowed",
    "border-red-600",
    "bg-zinc-100",
    "border-gray-200",
  ]) {
    assert.ok(theme.includes(token), `o formulário deve usar ${token}`);
  }
});

test("o preset expõe as escalas do core", () => {
  for (const token of [
    "--font-ui",
    "--font-display",
    "--tx",
    "--tx2",
    "--ln",
    "--focus",
    "--primary",
    "--accent2",
    "clamp(28px, 2.7vw, 38px)",
    "750",
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
  assert.doesNotMatch(config, /preflight:\s*false/);
});

test("o CSS legado não reaplica a base nem o wash do body", () => {
  assert.doesNotMatch(legacy, /^h1\{font:800 clamp/m);
  assert.doesNotMatch(legacy, /body\{background:radial-gradient[\s\S]{0,160}!important\}/);
  assert.match(legacy, /wash do body foi para o token `bg-vx-page`/);
});

test("o core Tailwind é carregado antes do legado", () => {
  const legado = layout.indexOf('import "./vexora.css"');
  const tailwind = layout.indexOf('import "./theme.css"');
  assert.ok(
    tailwind >= 0 && legado > tailwind,
    "as regras específicas de tela do legado precisam continuar vencendo",
  );
});

test("o shell padrão (sidebar, menu, topo) vive no core tokenizado", () => {
  assert.match(theme, /@layer components/);
  for (const selector of [
    ".suite-app",
    ".sidebar",
    ".sidebar-brand-row",
    ".side-nav",
    ".nav-item",
    ".nav-submenu",
    ".sidebar-bottom",
    ".main-area",
    ".topbar",
    ".breadcrumbs",
    ".page-content",
    ".page-footer",
    ".persistent-module-tabs",
  ]) {
    assert.ok(theme.includes(selector), `falta ${selector} no core do shell`);
  }
  for (const token of [
    "bg-indigo-950",
    "text-indigo-50",
    "text-indigo-400",
    "border-indigo-800",
    "bg-indigo-900",
    "z-sidebar",
    "w-sidebar",
    "ml-sidebar",
    "bg-neutral-100",
    "shadow-vx-nav-active",
  ]) {
    assert.ok(theme.includes(token), `o shell deve usar ${token}`);
  }
  const semanticColors =
    /(?:bg|border)-(?:sidebar|surface|ink|brand|line|topbar)\b|(?:^|\s)text-(?:sidebar|surface|ink(?:-secondary|-muted)?|brand|line|topbar)(?=\s|;|$)/m;
  assert.doesNotMatch(theme, semanticColors);
  assert.doesNotMatch(legacy, /^\.sidebar\{position:fixed/m);
  assert.match(legacy, /Migrado para `@layer components` em theme\.css/);
});

test("o contrato híbrido permanece: menu escuro, restante claro", () => {
  for (const token of [
    "--sb-bg",
    "--sb-on",
    "--sb-ln",
    "--sb-mut",
    "--sb-tx",
    "--sb-thumb",
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
    assert.ok(legacy.includes(token), `os temas devem definir ${token}`);
  }
  const hybrid = legacy.match(/:root\[data-theme=hybrid\]\{[^}]*\}/)?.[0] ?? "";
  assert.match(hybrid, /--sb-bg:#020617/);
  assert.match(hybrid, /--sb-tx:#F8FAFC/);
  assert.match(hybrid, /--sb-active:var\(--primary\)/);
  assert.doesNotMatch(hybrid, /--bg:/);

  const sidebarBlock = theme.match(/\.sidebar \{[\s\S]*?\n\s{2}\}/)?.[0] ?? "";
  assert.match(sidebarBlock, /bg-indigo-950/);
  assert.match(sidebarBlock, /text-indigo-50/);
  assert.match(sidebarBlock, /border-indigo-800/);
  assert.doesNotMatch(sidebarBlock, /bg-zinc-|text-slate-|border-gray-/);

  /* O item ativo precisa manter background-color na superfície da barra:
     bg-vx-nav-active sozinho só aplica background-image e deixa o item
     transparente quando a sidebar recebe uma cor customizada. */
  const activeItem = theme.match(/\.nav-item\.active,[\s\S]*?\n\s{2}\}/)?.[0] ?? "";
  assert.match(activeItem, /bg-indigo-700/);
  assert.match(activeItem, /bg-vx-nav-active/);
});

test("as cores do preset vêm da paleta documentada e dos tokens de tema", () => {
  assert.doesNotMatch(config, /color-mix\(/);
  for (const family of ["blue", "zinc", "slate", "gray", "indigo", "neutral", "emerald", "amber", "red", "sky"]) {
    assert.match(config, new RegExp(`\\n\\s+${family}: \\{`), `falta a paleta ${family}`);
  }
  assert.match(config, /700:\s*"var\(--primary-strong\)"/);
  assert.match(config, /950:\s*"var\(--sb-bg\)"/);
  assert.match(config, /700:\s*"var\(--sb-surface, var\(--sb-bg\)\)"/);
  for (const derived of [
    "--vx-core-page-wash",
    "--vx-core-topbar-bg",
    "--vx-core-selection",
    "--vx-core-line-soft",
    "--vx-core-shadow-nav-active",
  ]) {
    assert.ok(legacy.includes(derived), `${derived} precisa viver no tema`);
  }
});
