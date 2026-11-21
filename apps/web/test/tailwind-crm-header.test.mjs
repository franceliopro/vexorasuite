import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const crm = read("src/app/crm-workspace.tsx");
const config = read("tailwind.config.ts");
const a11y = read("test/tabs-tabpanels-a11y.test.mjs");

/** Só o cabeçalho e a barra de comandos migrados; o resto do CRM entra nas próximas fatias. */
const inicioHeader = crm.indexOf('data-testid="crm-header"');
const inicioBarra = crm.indexOf('data-testid="crm-command-bar"');
const fimBarra = crm.indexOf("\n      </div>", inicioBarra);
assert.ok(inicioHeader >= 0 && inicioBarra > inicioHeader && fimBarra > inicioBarra);
const migrado = crm.slice(inicioHeader, fimBarra);
/** Só as classes: hooks data-testid e ids de acessibilidade não são classes componente. */
const classes = [...migrado.matchAll(/className=(?:"([^"]*)"|\{([\s\S]*?)\})/g)].map((match) => match[1] ?? match[2]).join("\n");

test("o cabeçalho e a barra de comandos do CRM não usam classes componente", () => {
  const componentes = classes.replace(/(?:max|min)-w-crm-[a-z-]+/g, "");
  assert.doesNotMatch(componentes, /\bcrm-[a-z][a-z0-9-]*/);
  // As utilities ov-tablet:* do preset são aceitas; as classes ov-*/vx-*/ib-* de tela não.
  assert.doesNotMatch(componentes, /\b(?:ov|vx|ib)-[a-z][a-z0-9-]*(?=[\s"'+]|$)/);
});

test("a fatia migrate usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
    /@apply/,
  ]) {
    const match = migrado.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "flex flex-wrap items-center justify-between",
    "max-w-crm-copy",
    "min-w-crm-select max-w-crm-select",
    "inline-flex gap-1 rounded-full border border-gray-200 bg-zinc-100 p-1",
    "bg-blue-600 text-blue-900",
    "bg-blue-50 text-blue-800",
    "max-w-crm-search",
    "print:hidden",
  ]) {
    assert.ok(migrado.includes(utility), `falta a utility ${utility}`);
  }
});

test("o contrato de acessibilidade das 5 abas continua intacto", () => {
  for (const id of ["crm-tab-pipeline", "crm-tab-customers", "crm-tab-contacts", "crm-tab-origins", "crm-tab-reports"]) {
    assert.ok(crm.includes(`id="${id}"`), `perdeu ${id}`);
  }
  assert.equal((crm.match(/role="tab"/g) ?? []).length, 5);
  assert.equal((crm.match(/aria-controls="crm-tabpanel"/g) ?? []).length, 5);
  assert.ok(crm.includes('aria-label="Visualização do CRM"'));
  assert.ok(a11y.includes("Visualização do CRM"));
});

test("as medidas do cabeçalho vivem no preset", () => {
  for (const token of ['"crm-copy": "560px"', '"crm-select": "340px"', '"crm-search": "360px"', '"crm-select": "220px"']) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});
