import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const tasks = read("src/app/tasks-workspace.tsx");
const config = read("tailwind.config.ts");

/** A largura da barra de progresso é dado da tarefa, não remendo visual. */
const semDados = tasks.replace(/style=\{\{width:pct\+"%"\}\}/g, "");
/** Só as classes: data-testid, aria-* e ids não são classes componente. */
const classes = [...tasks.matchAll(/className=(?:"([^"]*)"|\{([\s\S]*?)\})/g)]
  .map((match) => match[1] ?? match[2])
  .join("\n");
/** As utilities com sufixo tasks-* vivem no preset e são aceitas. */
const semTokens = classes.replace(/\bgrid-cols-tasks-[a-z-]+/g, "");

test("Tarefas não usa classes componente", () => {
  assert.doesNotMatch(semTokens, /\b(?:tasks|calendar|ai|sites|content-card|primary-button|secondary-button|icon-button|dialog-close|chip)-[a-z][a-z0-9-]*/);
  assert.doesNotMatch(semTokens, /\b(?:ov|vx|ib)-[a-z][a-z0-9-]*(?=[\s"'+]|$)/);
  assert.doesNotMatch(semTokens, /\b(?:content-card|primary-button|secondary-button|icon-button|dialog-close|chip|ai-toggle)\b/);
});

test("Tarefas usa só utilities do preset, sem remendos", () => {
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
    'data-testid="tasks-workspace"',
    "grid-cols-tasks-reminders",
    "bg-slate-950/60",
    "z-wizard",
    "text-h1 font-heading",
    "accent-blue-600",
    "grid-flow-row",
  ].filter((item) => item !== "grid-flow-row")) {
    assert.ok(tasks.includes(utility), `falta a utility ${utility}`);
  }
  assert.ok(config.includes('"tasks-reminders": "repeat(auto-fit, minmax(210px, 1fr))"'));
});

test("a acessibilidade e os mocks de Tarefas continuam intactos", () => {
  assert.ok(tasks.includes('role="status"'));
  assert.equal((tasks.match(/role="alert"/g) ?? []).length, 2);
  assert.ok(tasks.includes('role="dialog"'));
  assert.ok(tasks.includes('aria-modal="true"'));
  assert.ok(tasks.includes('aria-label={editId?"Editar tarefa":"Nova tarefa"}'));
  assert.ok(tasks.includes('aria-label="Editar tarefa"'));
  assert.ok(tasks.includes('aria-label="Excluir tarefa"'));
  assert.ok(tasks.includes('aria-label="Fechar"'));
  assert.ok(tasks.includes('aria-label="Máximo de avisos por dia"'));
  assert.ok(tasks.includes("tabIndex={-1}"));
  assert.ok(tasks.includes("useModalDialog(form,modalRef,"));
  assert.doesNotMatch(tasks, /role="tablist"/);

  assert.ok(tasks.includes('fetch("/api/backend/tasks"+path'));
  assert.ok(tasks.includes('api<Task[]>("?status="+filter+"&scope=internal")'));
  assert.ok(tasks.includes('api<Metrics>("/metrics")'));
  assert.ok(tasks.includes('fetch("/api/backend/reminders/settings"'));
});
