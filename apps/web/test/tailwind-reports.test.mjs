import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const reports = read("src/app/reports-workspace.tsx");
const config = read("tailwind.config.ts");
const theme = read("src/app/theme.css");

/** Cores de gráficos, gradiente SVG e estilos dinâmicos são dados, não remendos visuais. */
const semDados = reports
  .replace(/const REPORTS_CSS = `[\s\S]*?`;\s*/, "")
  .replace(/style=\{\{[^}]*\}\}/g, "")
  .replace(/"#[0-9a-fA-F]{3,8}"/g, '""');

/** Só as classes: data-print, ids e aria-* não são classes componente. */
const classes = [...reports.matchAll(/className=(?:"([^"]*)"|\{([\s\S]*?)\})/g)]
  .map((match) => match[1] ?? match[2])
  .join("\n");
/** Variantes rw-* e utilities com sufixo rw-* vivem no preset e são aceitas. */
const semTokens = classes
  .replace(/\brw-(?:laptop|wide|mobile):[^\s"'+]+/g, "")
  .replace(/\b[a-z][a-z0-9-]*-rw-[a-z0-9-]+/g, "")
  .replace(/\b(?:shadow|bg|text|border)-vx-[a-z0-9-]+/g, "")
  .replace(/\b(?:chipTw|tabTw|deltaTw)\b/g, "");

test("Relatórios não usa classes componente", () => {
  assert.doesNotMatch(semTokens, /\b(?:rw|reports)-[a-z][a-z0-9-]*/);
  assert.doesNotMatch(semTokens, /\b(?:ov|vx|ib|content-card|primary-button|secondary-button|icon-button|dialog-close|chip|ai-toggle)\b/);
});

test("Relatórios usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = semDados.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "grid-cols-1",
    "lg:grid-cols-2",
    "w-28",
    "grid-cols-3",
    "max-w-2xl",
    "border-l-4",
    "text-3xl",
    "text-2xl",
    "text-base",
    "text-xs",
    "tracking-wider",
    "font-extrabold",
    "animate-pulse",
    "bg-zinc-300",
    "duration-300",
    "h-28",
    "h-36",
    "h-32",
    "w-2.5",
    "min-w-40",
    'data-print="print-root"',
    'data-print="top no-print"',
    'data-print="print-cover print-only"',
    "print:hidden",
    "hidden print:flex",
  ]) {
    assert.ok(reports.includes(utility), `falta a utility ${utility}`);
  }
  assert.doesNotMatch(classes, /\b[a-z][a-z0-9-]*-rw-[a-z0-9-]+/, "utility com token rw-* reintroduzida");
  for (const token of [
    '@custom-variant rw-wide (@media (max-width: 1100px));',
    '@custom-variant rw-laptop (@media (max-width: 900px));',
    '@custom-variant rw-mobile (@media (max-width: 560px));',
    '"rw-shimmer": "linear-gradient(100deg,var(--s3) 20%,var(--hover) 40%,var(--s3) 60%)"',
    '"rw-shimmer-size": "200% 100%"',
    '"rw-shimmer": "rw-shimmer 1.4s ease-in-out infinite"',
    '"rw-accent": "3px"',
    '"rw-title":',
    '"rw-value":',
    '"rw-card-title":',
    '"rw-hint":',
    '"rw-kpi-label":',
    '"rw-donut-total":',
    '"rw-kpi": "repeat(auto-fit, minmax(158px, 1fr))"',
    '"rw-2": "minmax(0, 1.08fr) minmax(0, 1fr)"',
    '"rw-hbar": "minmax(88px, 180px) minmax(0, 1fr) 52px"',
    '"rw-compare": "minmax(0, 1fr) auto auto"',
    '"rw-skel-card": "118px"',
    '"rw-donut": "132px"',
    '"rw-dot": "11px"',
    '"rw-legend": "170px"',
  ]) {
    assert.ok(config.includes(token) || theme.includes(token), `o preset deve expor ${token}`);
  }
});

test("REPORTS_CSS é somente o contrato de impressão com data-print", () => {
  const css = reports.slice(reports.indexOf("const REPORTS_CSS = `"));
  assert.ok(css.includes("@media print{"));
  assert.ok(css.includes("@page{size:A4"));
  assert.doesNotMatch(css, /\.rw-[a-z][a-z0-9-]*/);
  assert.doesNotMatch(css, /\.reports-(?:print-root|no-print|print-only)/);
  assert.doesNotMatch(css, /@media\s+(?!print)/);
  assert.ok(css.includes('[data-print~="no-print"]'));
  assert.ok(css.includes('[data-print~="print-only"]'));
  assert.ok(css.includes('[data-print~="print-root"]'));
});

test("a acessabilidade e os contratos de Relatórios continuam intactos", () => {
  assert.ok(reports.includes('searchParams.get("tab")'));
  assert.ok(reports.includes('new URLSearchParams(searchParams.toString())'));
  assert.ok(reports.includes("window.print()"));
  assert.ok(reports.includes('role="group" aria-label="Selecionar período"'));
  assert.ok(reports.includes("aria-pressed={preset === option.id}"));
  assert.equal((reports.match(/role="alert"/g) ?? []).length, 2);
  assert.equal((reports.match(/role="tabpanel"/g) ?? []).length, 6);
  assert.ok(reports.includes('aria-busy="true"'));
  assert.ok(reports.includes('role="status" aria-label="Carregando indicadores"'));
  assert.ok(reports.includes('id="rw-instagram"'));
  assert.ok((reports.match(/role="img"/g) ?? []).length >= 4);
  for (const label of [
    'aria-label="Seções de relatórios"',
    'aria-label="Volume de conversas por hora nas últimas 24 horas"',
    'aria-label="Evolução mensal de faturado e recebido"',
  ]) {
    assert.ok(reports.includes(label), `perdeu ${label}`);
  }
});

test("a exportação CSV e as APIs de Relatórios continuam intactas", () => {
  assert.ok(reports.includes('new Blob([csv], { type: "text/csv;charset=utf-8" })'));
  assert.ok(reports.includes("URL.createObjectURL(blob)"));
  assert.ok(reports.includes("link.download = filename"));
  for (const endpoint of [
    '"/api/backend/reports/service?"',
    '"/api/backend/overview"',
    '"/api/backend/finance/executive?"',
    '"/api/backend/crm/pipelines"',
    '"/api/backend/reports/lead-origins?"',
  ]) {
    assert.ok(reports.includes(endpoint), `perdeu ${endpoint}`);
  }
});
