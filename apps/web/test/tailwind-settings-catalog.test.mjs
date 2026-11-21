import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const catalog = read("src/app/settings-catalog.tsx");
const config = read("tailwind.config.ts");

/** O parser canônico não abre constantes referenciadas por className; resolvemos aqui. */
const constantes = Object.fromEntries(
  [...catalog.matchAll(/^const (\w+Tw) = "([^"]*)";\r?$/gm)].map((m) => [m[1], m[2]]),
);
const resolver = (termo) => constantes[termo] ?? termo.replace(/^"|"$/g, "");
const resolvido = catalog.replace(/className=\{(\w+Tw)\}/g, (_, nome) => ` className="${resolver(nome)}"`);

/** Só as classes resolvidas são analisadas; dados, ids e aria-* não são classes componente. */
const classes = [...resolvido.matchAll(/className="([^"]*)"/g)].map((m) => m[1]).join("\n");

/** Classes componente removidas desta fatia (sufixos catalog-* do preset são utilities). */
const legadas = [
  "settings-catalog", "settings-catalog-heading", "settings-catalog-search",
  "settings-catalog-section", "settings-catalog-grid", "settings-catalog-card",
  "settings-catalog-icon", "settings-catalog-copy", "settings-catalog-metric",
  "settings-catalog-arrow", "settings-catalog-empty", "settings-catalog-note",
  "settings-catalog-clearcache", "eyebrow", "page-subtitle",
];

test("o catálogo de configurações não usa classes componente", () => {
  for (const classe of legadas) {
    const re = new RegExp(`(?<![\\w-])${classe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    assert.equal(re.test(classes), false, `classe componente ${classe} permaneceu`);
  }
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /!important/,
    /@apply/,
  ]) {
    const match = resolvido.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  const hexEmClasse = [...resolvido.matchAll(/className="[^"]*#[0-9a-fA-F]{3,8}/g)];
  assert.equal(hexEmClasse.length, 0, "hex direto em classe");
  for (const utility of [
    "grid gap-6",
    "flex flex-wrap items-end justify-between gap-token",
    "text-catalog-eyebrow font-extrabold uppercase text-blue-600",
    "text-body text-slate-600",
    "min-h-control flex-1 basis-catalog-search-basis",
    "grid grid-cols-catalog-grid gap-token",
    "grid min-h-catalog-card grid-cols-catalog-card",
    "grid size-catalog-icon place-items-center rounded-catalog-icon bg-catalog-icon text-blue-800",
    "inline-grid h-catalog-metric min-w-catalog-metric place-items-center rounded-catalog-metric bg-blue-50",
    "min-h-catalog-clear w-full",
  ]) {
    assert.ok(resolvido.includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos do catálogo permanecem intactos", () => {
  for (const hook of [
    'aria-labelledby="settings-catalog-title"',
    'id="settings-catalog-title"',
    'aria-labelledby={"settings-section-" + section.title}',
    'id={"settings-section-" + section.title}',
    'aria-label="Buscar configurações"',
    'aria-label="Limpar busca"',
    "onClick={() => setQuery(\"\")}",
    "onClick={() => open(card)}",
    "onClick={() => void clearSystemCache()}",
    "data-tone={card.tone}",
  ]) {
    assert.ok(catalog.includes(hook), `perdeu ${hook}`);
  }
  for (const acao of ["onCompanies()", "onAdvanced()", "onNavigate(card.target)"]) {
    assert.ok(catalog.includes(acao), `perdeu ${acao}`);
  }
});

test("as medidas e cores do catálogo vivem no preset", () => {
  for (const token of [
    '"catalog-focus": "var(--focus)"',
    '"catalog-icon": "linear-gradient(150deg,var(--primary-soft),var(--s1))"',
    'ring: "var(--ring)"',
    '"catalog-sheen": "inset 0 1px 0 var(--sheen)"',
    '"catalog-icon": "12px"',
    '"catalog-metric": "8px"',
    '"catalog-eyebrow": ["10px", { lineHeight: "1.4", letterSpacing: ".16em" }]',
    '"catalog-metric": ["10.5px", { lineHeight: "1.4" }]',
    '"catalog-card-title": ["14px", { lineHeight: "1.3" }]',
    '"catalog-clear-title": ["12px", { lineHeight: "1.3", letterSpacing: "-.005em" }]',
    '"catalog-eyebrow-rule": "18px"',
    '"catalog-search-basis": "320px"',
    '"catalog-card-y": "14px"',
    '"catalog-card-x": "16px"',
    '"catalog-metric-x": "9px"',
    '"catalog-grid": "repeat(auto-fill,minmax(min(100%,300px),1fr))"',
    '"catalog-card": "auto minmax(0,1fr) auto auto"',
    '"catalog-icon": "42px"',
    '"catalog-metric": "24px"',
    '"catalog-card": "78px"',
    '"catalog-clear": "54px"',
    '"catalog-search": "420px"',
    '"catalog-metric": "26px"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});
