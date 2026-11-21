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

test("o core global usa Tailwind sem preflight, arbitrários ou hex", () => {
  assert.match(theme, /@tailwind components;/);
  assert.match(theme, /@tailwind utilities;/);
  assert.doesNotMatch(theme, /@tailwind base;/);

  const semComentarios = theme.replace(/\/\*[\s\S]*?\*\//g, "");

  for (const forbidden of [
    /\b(?:gray|slate|zinc|indigo|blue|green|amber|red)-\d{2,3}\b/,
    /\b(?:bg|text|border)-(?:white|black)\b/,
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
  ]) {
    const match = semComentarios.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }

  assert.match(theme, /\[hidden\]\s*\{\s*@apply hidden;\s*\}/);
  assert.ok(
    theme.indexOf("[hidden]") > theme.indexOf("@tailwind utilities;"),
    "[hidden] deve vir depois das utilities para vencer sem !important",
  );
});

test("os três temas continuam sendo a fonte dos tokens", () => {
  assert.match(legacy, /:root\[data-theme=hybrid\]/);
  assert.match(legacy, /:root\[data-theme=dark\]/);
  assert.match(legacy, /color-scheme:light/);
  assert.match(legacy, /color-scheme:dark/);
  assert.match(layout, /data-theme="hybrid"/);
  assert.match(layout, /localStorage\.getItem\("vexora:theme"\)/);
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
    "bg-surface-page",
    "text-ink",
    "border-line",
    "outline-focus",
    "font-ui",
  ]) {
    assert.ok(
      theme.includes(token) || config.includes(token.replace(/-/g, "")),
      `o core deve usar ${token}`,
    );
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
  assert.match(config, /preflight:\s*false/);
});

test("o CSS legado não reaplica a base nem o wash do body", () => {
  assert.doesNotMatch(legacy, /^h1\{font:800 clamp/m);
  assert.doesNotMatch(legacy, /body\{background:radial-gradient[\s\S]{0,160}!important\}/);
  assert.match(legacy, /wash do body foi para o token `bg-vx-page`/);
});

test("theme.css é carregado depois do CSS legado", () => {
  const legado = layout.indexOf('import "./vexora.css"');
  const tailwind = layout.indexOf('import "./theme.css"');
  assert.ok(legado >= 0 && tailwind > legado, "utilities precisam vir depois do legado");
});
