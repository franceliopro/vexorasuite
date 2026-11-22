import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const source = read("src/app/provider-connections.tsx");

/** Literais de className e constantes TW referenciadas por className são classes. */
function classValues(src) {
  const constants = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], [match[2]]);
  }
  /* Mapas `Record<string,string>` alternam chave e valor; só os valores
     (índices ímpares) são classes TW. */
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<string,string>\s*=\s*\{([\s\S]*?)\}/g)) {
    const pairs = [...match[2].matchAll(/(["'])([^"']*)\1/g)].map((item) => item[2]);
    constants.set(match[1], pairs.filter((_, index) => index % 2 === 1));
  }
  const values = [];
  for (const match of src.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  /* A referência é procurada no arquivo inteiro: o parser de expressão para
     no primeiro `}` de `${const}`, antes de alcançar mapas interpolados. */
  for (const [name, entries] of constants) {
    if (new RegExp(`\\b${name}\\b`).test(src)) values.push(...entries);
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

test("as conexões de IA não usam classes componente legadas", () => {
  for (const forbidden of [
    /^content-card$/m,
    /^ai-admin-(?:card|note|fields|toggle)\b/m,
    /^provider-status-(?:overview|head|retry|list|item|main|pill|detail|origin|action)\b/m,
    /^channel-health-warning\b/m,
    /\b(?:primary|secondary|danger|text|icon)-button\b/,
    /^is-(?:off|connected|rejected|offline|configured)\b/m,
  ]) {
    const match = legacyScanClasses.match(forbidden);
    assert.equal(match, null, `classe legada no JSX: ${match?.[0]}`);
  }
});

test("as conexões de IA usam só utilities, sem remendos", () => {
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
    "rounded-token",
    "rounded-provider-overview",
    "rounded-provider-item",
    "rounded-provider-pill",
    "rounded-provider-alert",
    "border-provider-alert",
    "bg-provider-connected-bg",
    "text-provider-connected-ink",
    "bg-provider-rejected-bg",
    "text-provider-rejected-ink",
    "bg-provider-offline-bg",
    "text-provider-offline-ink",
    "bg-provider-configured-bg",
    "text-provider-configured-ink",
    "text-provider-note",
    "text-provider-heading",
    "text-provider-detail",
    "text-provider-origin",
    "text-provider-alert",
    "text-provider-alert-strong",
    "text-provider-alert-ink",
    "p-provider-pad",
    "gap-provider-gap",
    "gap-provider-title-gap",
    "px-provider-pill-x",
    "py-provider-pill-y",
    "px-provider-alert-x",
    "py-provider-alert-y",
    "grid-cols-provider-status",
    "tracking-provider-pill",
    "tracking-provider-alert",
    "grid grid-cols-1 items-center gap-x-4 gap-y-2 rounded-provider-item border border-gray-200 bg-zinc-100 px-provider-pad py-3 md:grid-cols-provider-status",
    "bg-blue-600",
    "border-gray-200",
    "bg-zinc-200",
    "text-slate-950",
    "text-red-600",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
  /* Classe viva em template literal: o parser de expressão para no `${}`. */
  assert.match(source, /justify-self-start md:justify-self-end/);
});

test("o preset expõe os tokens das conexões de IA", () => {
  for (const token of [
    '"provider-connected-bg": "#DCFCE7"',
    '"provider-connected-ink": "#14532D"',
    '"provider-rejected-bg": "#FEE2E2"',
    '"provider-rejected-ink": "#7F1D1D"',
    '"provider-offline-bg": "#FEF3C7"',
    '"provider-offline-ink": "#713F12"',
    '"provider-configured-bg": "#DBEAFE"',
    '"provider-configured-ink": "#1E3A8A"',
    '"provider-alert-line": "rgba(229,72,77,.42)"',
    '"provider-alert-ink": "#C2494E"',
    '"provider-alert": "1.5px"',
    '"provider-overview": "14px"',
    '"provider-item": "12px"',
    '"provider-pill": "6px"',
    '"provider-note": ["11px", { lineHeight: "1.55" }]',
    '"provider-heading": ["14px", { lineHeight: "1.2" }]',
    '"provider-pill": ["10px", { lineHeight: "1" }]',
    '"provider-pad": "14px"',
    '"provider-gap": "10px"',
    '"provider-status": "minmax(0,1.4fr) 1fr auto"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("as conexões de IA preservam estados, ações e acessibilidade", () => {
  for (const marker of [
    'aria-label="Conexões de IA e pesquisa"',
    'aria-label="Status das conexões de IA e pesquisa"',
    'aria-expanded={editing}',
    'role="status">Verificando conexões…',
    'role="alert" className="text-body text-red-600">{error}',
    'onClick={()=>setConnectionsAttempt(v=>v+1)}',
    'onClick={()=>void savePolicy()}',
    'name="ai-provider-key"',
    'data-provider-status={state}',
    'href="https://openrouter.ai/settings/credits"',
    'rel="noreferrer"',
  ]) {
    assert.ok(source.includes(marker), `faltou ${marker}`);
  }
  assert.doesNotMatch(source, /\.catch\(\(\)=>\{\}\)/);
});
