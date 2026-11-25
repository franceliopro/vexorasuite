import { isCompletedBeforeToday, startOfTasksDay, tasksStatusWhere } from "./tasks-filter";

describe("tasks status filters", () => {
  const now = new Date(2026, 10, 25, 14, 30, 0);

  it("keeps done as every completed task and doneToday as the narrower midnight cut", () => {
    expect(tasksStatusWhere("done", now)).toEqual({ status: "DONE" });
    expect(tasksStatusWhere("doneToday", now)).toEqual({ status: "DONE", completedAt: { gte: startOfTasksDay(now) } });
    expect(tasksStatusWhere("doneToday", now).completedAt?.gte?.getTime()).toBe(new Date(2026, 10, 25).getTime());
  });

  it("does not count earlier completions as completed today", () => {
    const earlier = new Date(2026, 10, 24, 18, 0, 0);
    const today = new Date(2026, 10, 25, 9, 0, 0);
    expect(isCompletedBeforeToday(earlier, now)).toBe(true);
    expect(isCompletedBeforeToday(today, now)).toBe(false);
    expect(isCompletedBeforeToday(null, now)).toBe(false);
  });

  it("keeps the active, overdue and all meanings unchanged", () => {
    expect(tasksStatusWhere(undefined, now)).toEqual({ status: { not: "DONE" } });
    expect(tasksStatusWhere("active", now)).toEqual({ status: { not: "DONE" } });
    expect(tasksStatusWhere("all", now)).toEqual({});
    expect(tasksStatusWhere("overdue", now)).toEqual({ status: { not: "DONE" }, dueAt: { lt: now } });
  });
});
