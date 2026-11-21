import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const source = read("src/app/asaas-settings.tsx");

/** Literais de className e constantes TW referenciadas por className são classes. */
function classValues(src) {
  const constants = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of src.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
  }
  return values.join("\n");
}
const classes = classValues(source);
const vxDeclared = new Set([...config.matchAll(/"(vx-[a-z0-9-]+)"/g)].map((match) => match[1]));
const legacyScanClasses = classes
  .split(/\s+/)
  .filter((token) => {
    const name = token.match(/vx-[a-z0-9-]+/)?.[0];
    return !(name && vxDeclared.has(name) && /^[a-z][a-z0-9-]*-vx-[a-z0-9-]+$/.test(token));
  })
  .join("\n");

test("a configuração do Asaas não usa classes componente legadas", () => {
  for (const forbidden of [
    /^content-card$/m,
    /^settings-(?:card|card-heading|icon|feedback|toggle|field|muted|webhook-url|actions|hint)$/m,
    /^channels-asaas-(?:card|grid|fields)$/m,
    /\b(?:primary|secondary|danger|text|icon)-button\b/,
    /\berror\b/,
    /\bsuccess\b/,
  ]) {
    const match = legacyScanClasses.match(forbidden);
    assert.equal(match, null, `classe legada no JSX: ${match?.[0]}`);
  }
});

test("a configuração do Asaas usa só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  for (const utility of [
    "rounded-asaas-card",
    "rounded-asaas-icon",
    "h-asaas-icon",
    "w-asaas-icon",
    "h-asaas-check",
    "w-asaas-check",
    "py-asaas-toggle",
    "text-asaas-title",
    "text-asaas-label",
    "text-asaas-muted",
    "grid-cols-channels-asaas-grid",
    "bg-blue-600",
    "border-gray-200",
    "bg-zinc-200",
    "text-slate-950",
    "text-emerald-600",
    "text-red-600",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os tokens da configuração do Asaas", () => {
  for (const token of [
    '"asaas-card": "14px"',
    '"asaas-icon": "9px"',
    '"asaas-icon": "34px"',
    '"asaas-check": "17px"',
    '"asaas-toggle": "9px"',
    '"asaas-title": "15px"',
    '"asaas-label": "11px"',
    '"asaas-muted": ["10.5px", { lineHeight: "1.5" }]',
    '"channels-asaas-grid": "repeat(auto-fit,minmax(200px,1fr))"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("a configuração do Asaas preserva estados e ações", () => {
  for (const marker of [
    'role="status">Carregando configuração do Asaas',
    'role="alert">{loadError}',
    "onClick={()=>void loadAsaas()}",
    'aria-busy="true"',
  ]) {
    assert.ok(source.includes(marker), ` faltou ${marker}`);
  }
  assert.doesNotMatch(source, /\.catch\(\(\)=>\{\}\)/);
});
