import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const source = read("src/app/custom-fields-settings.tsx");

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
  }
  for (const [name, value] of constants) {
    if (new RegExp(`\\b${name}\\b`).test(src)) values.push(value);
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

test("as configurações de campos não usam classes componente legadas", () => {
  for (const forbidden of [
    /^content-card$/m,
    /^settings-(?:card|card-heading|feedback|list|list-row|field|field-grid|muted|toggle|field-error)\b/m,
    /^conversation-tag\b/m,
    /\b(?:primary|secondary|danger|text|icon)-button\b/,
    /^is-(?:off|connected|rejected|offline|configured)\b/m,
  ]) {
    const match = legacyScanClasses.match(forbidden);
    assert.equal(match, null, `classe legada no JSX: ${match?.[0]}`);
  }
});

test("as configurações de campos usam só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
    /color-mix\(/,
  ]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  for (const utility of [
    "rounded-token",
    "rounded-token-sm",
    "rounded-cf-tag",
    "bg-zinc-200",
    "bg-zinc-100",
    "bg-red-100",
    "bg-emerald-100",
    "border-red-600",
    "border-emerald-600",
    "text-red-600",
    "text-emerald-600",
    "text-blue-600",
    "accent-blue-600",
    "p-pad",
    "px-cf-tag-x",
    "min-h-cf-tag",
    "grid-cols-cf-fields",
    "grid-cols-cf-tag-row",
    "grid-cols-cf-field-row",
    "text-asaas-title",
    "text-asaas-label",
    "text-asaas-muted",
    "text-2xs",
    "grid grid-cols-1 gap-3 md:grid-cols-cf-fields",
    "grid grid-cols-1 items-center gap-2 md:grid-cols-cf-tag-row",
    "grid grid-cols-1 items-center gap-2 md:grid-cols-cf-field-row",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os tokens do catálogo de campos", () => {
  for (const token of [
    '"cf-tag": "99px"',
    '"cf-tag-x": "9px"',
    '"cf-tag-h": "23px"',
    '"cf-fields": "repeat(2,minmax(0,1fr))"',
    '"cf-tag-row": "minmax(0,1fr) 92px auto auto auto"',
    '"cf-field-row": "minmax(0,1fr) auto auto"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("as configurações de campos preservam contratos e acessibilidade", () => {
  for (const marker of [
    'role="alert"',
    'role="status"',
    '"/api/backend/crm/custom-fields"',
    '"/api/backend/contacts/profile-config"',
    '"/api/backend/contacts/profile-config/tags"',
    'method: "POST"',
    'method: "PATCH"',
    'method: "DELETE"',
    'style={{ backgroundColor: tag.color, color: "#111827" }}',
    'type="color"',
    'maxLength={40}',
    'maxLength={80}',
    'maxLength={120}',
    '<option value="TEXT">Texto</option>',
    '<option value="BOOLEAN">Sim ou não</option>',
    'Campos personalizados salvos.',
    'Tag criada no catálogo.',
  ]) {
    assert.ok(source.includes(marker), `faltou ${marker}`);
  }
  assert.ok(source.includes("/^#[0-9a-fA-F]{6}$/"), "faltou a validação hexadecimal da cor da tag");
});
