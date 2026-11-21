import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const config = read("tailwind.config.ts");
const styles = read("src/app/overview.css");
const layout = read("src/app/layout.tsx");
const overview = read("src/app/overview-intelligence.tsx");
const widgets = read("src/app/dashboard-widgets.tsx");
const onboarding = read("src/app/onboarding-checklist.tsx");
const page = read("src/app/page.tsx");
const visualRegression = read("e2e/inbox-visual-regression.mjs");
const components = `${overview}\n${widgets}\n${onboarding}`;

test("a Visão geral carrega o CSS isolado depois do tema e do legado", () => {
  const theme = layout.indexOf('import "./theme.css"');
  const legacy = layout.indexOf('import "./vexora.css"');
  const isolated = layout.indexOf('import "./overview.css"');
  assert.ok(theme >= 0 && legacy > theme && isolated > legacy);
});

test("o namespace ov-* substitui vx-* nos componentes da Visão geral", () => {
  assert.doesNotMatch(components, /\bvx-[a-z0-9-]+/);
  assert.match(components, /\bov-hero\b/);
  assert.match(components, /\bov-kpi-cell\b/);
  assert.match(components, /\bov-widget\b/);
  assert.match(components, /\bov-onboarding\b/);
  assert.match(page, /\bov-access-panel\b/);
  assert.match(page, /\bov-dock\b/);
  assert.doesNotMatch(page, /\bvx-access-[a-z-]+|mobile-overview-nav/);
  assert.match(visualRegression, /\.ov-hero/);
  assert.doesNotMatch(visualRegression, /\.vx-hero/);
});

test("o CSS da Visão geral não usa preflight, arbitrários, hex, !important ou color-mix fora do tema", () => {
  const semComentarios = styles.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(semComentarios, /@tailwind components;/);
  assert.match(semComentarios, /@tailwind utilities;/);
  assert.doesNotMatch(semComentarios, /@tailwind base;/);

  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
  ]) {
    const match = semComentarios.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }

  const semDerivados = semComentarios.replace(/:root\s*\{[^}]*\}/g, "");
  assert.doesNotMatch(semDerivados, /color-mix\(/);
});

test("a Visão geral usa apenas a paleta documentada mapeada no preset", () => {
  const semComentarios = styles.replace(/\/\*[\s\S]*?\*\//g, "");
  const aliases = /\b(?:bg|text|border|from|to|via|stroke|fill)-(?:surface(?:-\d+)?|ink(?:-secondary|-muted)?|line(?:-strong|-soft|-footer|-hover)?|brand(?:-soft|-ink|-strong|-contrast)?|danger|accent|focus|selection|overlay(?:-soft)?|topbar|hover|sidebar(?:-on|-line|-muted|-text|-thumb)?|success(?:-soft)?|warning(?:-soft)?)\b/;
  assert.doesNotMatch(semComentarios, aliases);

  for (const token of [
    "text-slate-950",
    "text-slate-600",
    "text-slate-400",
    "bg-zinc-100",
    "bg-zinc-200",
    "bg-zinc-300",
    "border-gray-200",
    "bg-blue-50",
    "bg-blue-600",
    "bg-indigo-950",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-red-100",
    "bg-sky-100",
  ]) {
    assert.ok(styles.includes(token), `a Visão geral deve usar ${token}`);
  }
});

test("nenhuma classe da Visão geral termina em -card nem herda .content-card", () => {
  const escopo = `${styles}\n${overview}\n${page}`;
  assert.doesNotMatch(escopo, /\bov-[a-z0-9-]*-card\b/);
  assert.doesNotMatch(escopo, /content-card\s+ov-/);
  assert.match(styles, /\.ov-dock\s*\{[\s\S]*?fixed[\s\S]*?bottom-0[\s\S]*?z-dock/);
});

test("o preset expõe as escalas e os derivados da Visão geral", () => {
  for (const token of [
    '"ov-laptop"',
    '"ov-tablet"',
    '"ov-mobile"',
    '"ov-hero"',
    '"ov-hero-sm"',
    '"ov-kpi"',
    '"ov-clock"',
    '"ov-weather"',
    '"ov-micro"',
    '"ov-label"',
    '"ov-sub"',
    '"ov-onboarding"',
    '"ov-overview"',
    '"ov-primary"',
    '"ov-main"',
    '"ov-hero-body"',
    '"ov-team-row"',
    '"ov-kpi"',
    '"ov-access"',
    '"ov-topics"',
    '"ov-widgets"',
    '"ov-onboarding-steps"',
    '"ov-dock"',
    '"ov-calendar"',
    '"ov-ring"',
    '"ov-ring-tile"',
    '"ov-avatar"',
    '"ov-dock-btn"',
    '"ov-dock-gap"',
    '"ov-dock-pb"',
    '"ov-heading"',
    'dock: "45"',
    'ov: "5.5"',
    '100: "var(--vx-bad-soft)"',
    '100: "var(--vx-accent-soft)"',
    'stroke: "stroke-dashoffset"',
    'fill: "width"',
    'ring: "600ms"',
    'bar: "300ms"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("os estilos inline da Visão geral são apenas larguras data-driven", () => {
  assert.doesNotMatch(components, /style=\{\{(?!\s*width:)/);
  assert.doesNotMatch(components, /color-mix\(|#[0-9a-fA-F]{3,8}\b/);
  assert.ok((components.match(/style=\{\{\s*width:/g) || []).length >= 3);
});
