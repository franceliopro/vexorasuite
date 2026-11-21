import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const crm = read("src/app/crm-workspace.tsx");
const config = read("tailwind.config.ts");

/** Só o Kanban migrado; Clientes/Contatos e diálogos entram nas próximas fatias. */
const inicio = crm.indexOf('data-testid="crm-pipeline"');
const fim = crm.indexOf('view === "origins"', inicio);
assert.ok(inicio >= 0 && fim > inicio, "a fatia do Kanban não foi encontrada");
const migrado = crm.slice(inicio, fim);

/** Cores de tag são dados do contato, não remendos visuais. */
const semDados = migrado
  .replace(/style=\{\{[^}]*\}\}/g, "")
  .replace(/const color=tag\.color\|\|"#[0-9a-fA-F]{3,8}";/g, "");
/** Só as classes: data-testid, ids e aria-* não são classes componente. */
const classes = [...migrado.matchAll(/className=(?:"([^"]*)"|\{([\s\S]*?)\})/g)]
  .map((match) => match[1] ?? match[2])
  .join("\n");
/** As utilities com sufixo crm-* vivem no preset e são aceitas. */
const semTokens = classes.replace(
  /(?:\b|\s)(?:min|max)-[hw]-crm-[a-z-]+|\b(?:auto-cols|border-t|w|py)-crm-[a-z-]+/g,
  "",
);

test("o Kanban do CRM não usa classes componente", () => {
  assert.doesNotMatch(semTokens, /\bcrm-[a-z][a-z0-9-]*/);
  // As utilities ov-tablet:* do preset são aceitas; classes de tela não.
  assert.doesNotMatch(semTokens, /\b(?:ov|vx|ib)-[a-z][a-z0-9-]*(?=[\s"'+]|$)/);
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
    /@apply/,
  ]) {
    const match = semDados.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    'data-testid="crm-pipeline"',
    "grid-flow-col auto-cols-crm-stage",
    "min-h-crm-column max-h-crm-column",
    "snap-x snap-proximity",
    "from-blue-50 to-zinc-200",
    "w-crm-accent",
    "border-t-crm-stage",
    "group-hover:text-blue-800",
  ]) {
    assert.ok(migrado.includes(utility), `falta a utility ${utility}`);
  }
});

test("o drag e a acessibilidade do Kanban continuam intactos", () => {
  assert.ok(crm.includes('id="crm-tabpanel"'));
  assert.ok(crm.includes('role="tabpanel"'));
  assert.ok(crm.includes('aria-labelledby={`crm-tab-${view}`}'));
  assert.ok(migrado.includes('aria-label="Pipeline comercial"'));
  assert.ok(crm.includes('data-testid="crm-loading"'));
  assert.ok(crm.includes("py-crm-loading-y"));
  assert.ok(crm.includes("animate-spin"));

  for (const handler of ["onDragOver", "onDragLeave", "onDrop", "onDragStart", "onDragEnd"]) {
    assert.ok(migrado.includes(handler), `perdeu ${handler}`);
  }
  assert.ok(migrado.includes("draggable"));
  assert.ok(crm.includes('event.dataTransfer.effectAllowed = "move"'));
  assert.ok(crm.includes('event.dataTransfer.setData("text/plain", contact.id)'));
  assert.ok(crm.includes('event.dataTransfer.getData("text/plain")'));

  for (const label of [
    'aria-label={"Adicionar contato em " + stage.label}',
    'aria-label={"Abrir ficha de " + contactName(contact)}',
    'aria-label={"Progresso no pipeline — etapa "',
    'aria-label={"Ações rápidas para " + contact.name}',
    'aria-label={"Chamar " + contact.name + " no WhatsApp"}',
    'aria-label={"Ligar para " + contact.name}',
    'aria-label={"Enviar e-mail para " + contact.name}',
    'aria-label={"Mover " + contactName(contact) + " para outra etapa"}',
    'aria-label={"Retirar "+contact.name+" do pipeline"}',
  ]) {
    assert.ok(migrado.includes(label), `perdeu ${label}`);
  }
  assert.equal((migrado.match(/role="group"/g) ?? []).length >= 1, true);
  assert.ok(migrado.includes('role="img"'));
});

test("as medidas do Kanban vivem no preset", () => {
  for (const token of [
    '"crm-stage": "minmax(272px, 1fr)"',
    '"crm-column": "280px"',
    '"crm-card": "152px"',
    '"crm-heading": "62px"',
    '"crm-column": "calc(100dvh - var(--top) - 235px)"',
    '"crm-accent": "3px"',
    '"crm-stage": "3px"',
    '"crm-loading-y": "60px"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});
