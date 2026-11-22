import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("src/app/module-choices.tsx");
const config = read("tailwind.config.ts");

/** Só os usos em className entram na varredura; constantes TW são resolvidas. */
const constants = new Map();
for (const m of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
  constants.set(m[1], m[2]);
}
const classes = [...source.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
  .map((m) => {
    if (m[1] !== undefined) return m[1];
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(m[2])) return value;
    }
    return m[2] ?? "";
  })
  .join("\n");

test("module-choices não usa mais classes componente legadas", () => {
  for (const classe of ["module-permissions", "ai-toggle", "primary-button", "secondary-button", "content-card"]) {
    const re = new RegExp(`(?<![\\w-])${classe}(?![\\w-])`);
    assert.equal(re.test(classes), false, `classe componente ${classe} permaneceu`);
  }
  assert.equal(/className="[^"]+"/.test(source), false, "className literal de componente permaneceu");
});

test("module-choices usa só utilities literais do preset, sem remendos", () => {
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /!important/, /@apply/, /color-mix\(/, /#[0-9a-fA-F]{3,8}/]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "grid grid-cols-modules content-start gap-1.5",
    "inline-flex cursor-pointer items-center gap-2 font-medium text-modules-label",
    "size-4 flex-none accent-blue-600",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
  assert.ok(config.includes('"modules": "repeat(auto-fill,minmax(170px,1fr))"'), "preset perdeu a grade modules");
  assert.ok(config.includes('"modules-label": "11px"'), "preset perdeu o tamanho modules-label");
});

test("os contratos de permissões de módulo permanecem intactos", () => {
  for (const token of [
    'export const moduleLabels: Record<string, string>',
    'INBOX: "Atendimento"', 'CRM: "CRM"', 'CALENDAR: "Calendários"', 'TASKS: "Tarefas"',
    'AUTOMATION: "Automação e agentes de IA"', 'MARKETING: "Marketing e Drive"',
    'FINANCE: "Financeiro"', 'CHANNELS: "Conexões"', 'SETTINGS: "Configurações"',
    'export function ModuleChoices(', 'value: string[]', 'onChange: (v: string[]) => void',
    'allowed?: string[]', '<fieldset', '<legend>Módulos permitidos</legend>',
    'Object.entries(moduleLabels).map(([id, label])', 'key={id}',
    'type="checkbox"', 'disabled={allowed !== undefined && !allowed.includes(id)}',
    'checked={value.includes(id)}', 'e.target.checked', '[...value, id]',
    'value.filter((x) => x !== id)', '{label}',
  ]) {
    assert.ok(source.includes(token), `module-choices perdeu ${token}`);
  }
});
