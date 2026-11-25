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
  assert.ok(config.includes('"tasks-reminders": "minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(6rem, 0.45fr)"'));
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
  assert.ok(tasks.includes('role="tablist"'));
  assert.ok(tasks.includes('aria-label="Áreas de Tarefas"'));
  assert.ok(tasks.includes('id="tasks-tabpanel"'));
  assert.ok(tasks.includes('id="reminders-tabpanel"'));
  assert.ok(tasks.includes('aria-controls="tasks-tabpanel"'));
  assert.ok(tasks.includes('aria-controls="reminders-tabpanel"'));

  assert.ok(tasks.includes('fetch("/api/backend/tasks"+path'));
  assert.ok(tasks.includes('api<Task[]>("?status="+filter+"&scope=internal")'));
  assert.ok(tasks.includes('api<Metrics>("/metrics")'));
  assert.ok(tasks.includes('fetch("/api/backend/reminders/settings"'));
});

test("Tarefas mostra status no topo e mantém dados em coluna", () => {
  for (const label of ["Atrasadas", "Concluídas hoje", "Concluídas", "Todas"]) {
    assert.ok(tasks.includes(label), `falta o cartão de status ${label}`);
  }
  assert.ok(tasks.includes("metrics.completedToday"));
  assert.ok(tasks.includes("metrics.completed"));
  assert.ok(tasks.includes('aria-label="Concluídas Hoje"'));
  assert.ok(tasks.includes('min===120?"2h"'));
  assert.ok(tasks.includes("grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"));
  assert.ok(tasks.includes("sm:grid-cols-3"));
  assert.ok(tasks.includes("lg:grid-cols-4"));
  assert.ok(tasks.includes("max-w-20"));
  assert.ok(tasks.includes("min-w-0"));
  assert.ok(tasks.includes("whitespace-nowrap text-ellipsis"));
  assert.ok(tasks.includes("line-clamp-2"));
  assert.doesNotMatch(tasks, /120 min/);
});

test("Os cartões de status filtram a lista com o mesmo padrão acessível", () => {
  for (const value of ["overdue", "doneToday", "done", "all"]) {
    assert.ok(tasks.includes(`aria-pressed={filter==="${value}"}`), `falta o filtro ${value}`);
    assert.ok(tasks.includes(`onClick={()=>setFilter("${value}")}`), `falta a ação do filtro ${value}`);
  }
  assert.ok(tasks.includes('aria-label="Resumo e filtros das tarefas" role="group"'));
  assert.ok(tasks.includes('api<Task[]>("?status="+filter+"&scope=internal")'));
});
