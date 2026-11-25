import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
import { RemindersService } from "./reminders.service";
import { allowsNotification } from "./notification-preferences";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function setup(events: string[]) {
  const prisma: any = {
    tenant: {
      findMany: jest.fn().mockResolvedValue([{
        id: TENANT,
        integrations: { reminders: { minutesBefore: [15], push: true } },
      }]),
    },
    workTask: {
      findMany: jest.fn().mockResolvedValue([{
        id: "task",
        title: "Entregar relatório",
        dueAt: new Date(Date.now() + 5 * 60e3),
        assigneeId: USER,
      }]),
    },
    userNotificationPreference: {
      findMany: jest.fn().mockResolvedValue([{ userId: USER, events }]),
    },
  };
  const push: any = { notifyReminder: jest.fn().mockResolvedValue(undefined) };
  return { prisma, push, service: new RemindersService(prisma, push) };
}

describe("task due notification preferences", () => {
  it("sends the existing reminder to an opted-in assignee", async () => {
    const { prisma, push, service } = setup(["TASK_DUE"]);
    await service.tick();
    expect(prisma.userNotificationPreference.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, userId: { in: [USER] } },
      select: { userId: true, events: true },
    });
    expect(push.notifyReminder).toHaveBeenCalledWith(
      TENANT,
      [USER],
      expect.objectContaining({ tag: "task-task" }),
    );
  });

  it("suppresses the reminder when TASK_DUE is disabled", async () => {
    expect(allowsNotification(["MENTION"], "TASK_DUE")).toBe(false);
    const { push, service } = setup(["MENTION"]);
    await service.tick();
    expect(push.notifyReminder).not.toHaveBeenCalled();
  });
});
