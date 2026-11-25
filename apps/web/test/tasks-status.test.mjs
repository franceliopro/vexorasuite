import test from "node:test";
import assert from "node:assert/strict";
import { isCompletedBeforeToday, isCompletedToday, tasksForFilter } from "../src/lib/task-status.ts";

const now = new Date(2026, 10, 25, 14, 30, 0);
const tasks = [
  { id: "ontem", status: "DONE", completedAt: new Date(2026, 10, 24, 18, 0, 0) },
  { id: "hoje", status: "DONE", completedAt: new Date(2026, 10, 25, 9, 0, 0) },
  { id: "aberta", status: "OPEN", completedAt: null, dueAt: new Date(2026, 10, 26, 9, 0, 0) },
  { id: "atrasada", status: "OPEN", completedAt: null, dueAt: new Date(2026, 10, 24, 9, 0, 0) },
];

test("Concluídas inclui tarefas finalizadas em datas anteriores", () => {
  assert.deepEqual(tasksForFilter(tasks, "done", now).map((task) => task.id), ["ontem", "hoje"]);
});

test("Concluídas hoje mantém apenas o recorte desde a meia-noite", () => {
  assert.deepEqual(tasksForFilter(tasks, "doneToday", now).map((task) => task.id), ["hoje"]);
  assert.equal(isCompletedToday(tasks[0], now), false);
  assert.equal(isCompletedToday(tasks[1], now), true);
  assert.equal(isCompletedBeforeToday(tasks[0], now), true);
  assert.equal(isCompletedBeforeToday(tasks[1], now), false);
});

test("Atrasadas, Em andamento e Todas preservam os critérios anteriores", () => {
  assert.deepEqual(tasksForFilter(tasks, "overdue", now).map((task) => task.id), ["atrasada"]);
  assert.deepEqual(tasksForFilter(tasks, "active", now).map((task) => task.id), ["aberta", "atrasada"]);
  assert.deepEqual(tasksForFilter(tasks, "all", now).map((task) => task.id), ["ontem", "hoje", "aberta", "atrasada"]);
});
