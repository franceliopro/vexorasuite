export type TasksStatusFilter = "active" | "overdue" | "done" | "doneToday" | "all";

type TasksStatusWhere = {
  status?: string | { not: string };
  dueAt?: { lt: Date };
  completedAt?: { gte: Date };
};

/** Meia-noite local, usada de forma idêntica pelos filtros e pelas métricas. */
export function startOfTasksDay(now: Date | number = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Uma única fonte para os filtros de status das tarefas internas.
 * "done" continua significando todas as concluídas; "doneToday" é o recorte
 * mais estreito, desde a meia-noite de hoje.
 */
export function tasksStatusWhere(status = "active", now: Date | number = new Date()): TasksStatusWhere {
  switch (status) {
    case "done":
      return { status: "DONE" };
    case "doneToday":
      return { status: "DONE", completedAt: { gte: startOfTasksDay(now) } };
    case "overdue":
      return { status: { not: "DONE" }, dueAt: { lt: new Date(now) } };
    case "all":
      return {};
    default:
      return { status: { not: "DONE" } };
  }
}

/** Concluídas anteriores ao recorte de hoje, sem repetir "Concluídas hoje". */
export function isCompletedBeforeToday(completedAt: Date | null | undefined, now: Date | number = new Date()): boolean {
  if (!completedAt || !Number.isFinite(completedAt.getTime())) return false;
  return completedAt.getTime() < startOfTasksDay(now).getTime();
}
