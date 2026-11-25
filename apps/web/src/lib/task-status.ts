export type TaskStatusFilter = "active" | "overdue" | "doneToday" | "done" | "all";

export type TaskWithCompletion = {
  status?: string | null;
  dueAt?: string | Date | null;
  completedAt?: string | Date | null;
};

/** Meia-noite local para o recorte "Concluídas hoje". */
export function startOfTaskDay(now: Date | number = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function dateValue(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function isCompleted(task: TaskWithCompletion): boolean {
  return task.status === "DONE";
}

export function isCompletedToday(task: TaskWithCompletion, now: Date | number = new Date()): boolean {
  if (!isCompleted(task)) return false;
  const completedAt = dateValue(task.completedAt);
  return !!completedAt && completedAt.getTime() >= startOfTaskDay(now).getTime();
}

/** Inclui concluídas de qualquer data, sem duplicar o recorte de hoje. */
export function isCompletedBeforeToday(task: TaskWithCompletion, now: Date | number = new Date()): boolean {
  if (!isCompleted(task)) return false;
  const completedAt = dateValue(task.completedAt);
  return !!completedAt && completedAt.getTime() < startOfTaskDay(now).getTime();
}

export function matchesTaskFilter<T extends TaskWithCompletion>(task: T, filter: TaskStatusFilter, now: Date | number = new Date()): boolean {
  switch (filter) {
    case "done":
      return isCompleted(task);
    case "doneToday":
      return isCompletedToday(task, now);
    case "overdue": {
      const dueAt = dateValue(task.dueAt);
      return !isCompleted(task) && !!dueAt && dueAt.getTime() < new Date(now).getTime();
    }
    case "all":
      return true;
    default:
      return !isCompleted(task);
  }
}

export function tasksForFilter<T extends TaskWithCompletion>(tasks: T[], filter: TaskStatusFilter, now: Date | number = new Date()): T[] {
  return tasks.filter((task) => matchesTaskFilter(task, filter, now));
}
