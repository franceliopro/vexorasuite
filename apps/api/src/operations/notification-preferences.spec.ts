import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { NotificationPreferencesController } from "./notification-preferences.controller";
import {
  DEFAULT_NOTIFICATION_EVENTS,
  allowsNotification,
  normalizeNotificationEvents,
  notificationEventsOf,
} from "./notification-preferences";

const TENANT = "11111111-1111-4111-8111-111111111111";
const SELF = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

function setup() {
  const prisma: any = {
    membership: { findFirst: jest.fn().mockResolvedValue({ id: "membership" }) },
    userNotificationPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  return { prisma, controller: new NotificationPreferencesController(prisma) };
}

const selfRequest: any = {
  user: { sub: SELF, tenantId: TENANT, role: "AGENT", isPlatformAdmin: false },
};
const adminRequest: any = {
  user: { sub: SELF, tenantId: TENANT, role: "ADMIN", isPlatformAdmin: false },
};

describe("per-user notification preferences", () => {
  it("exposes only events that the product actually emits, all enabled by default", () => {
    expect(DEFAULT_NOTIFICATION_EVENTS).toEqual([
      "CONVERSATION_ASSIGNED_TO_ME",
      "CONVERSATION_ASSIGNED_TO_MY_TEAM",
      "MENTION",
      "TASK_DUE",
      "CONVERSATION_MESSAGE_RECEIVED",
    ]);
    expect(normalizeNotificationEvents(["TASK_DUE", "MENTION", "TASK_DUE"])).toEqual([
      "MENTION",
      "TASK_DUE",
    ]);
    expect(notificationEventsOf(null)).toEqual(DEFAULT_NOTIFICATION_EVENTS);
    expect(notificationEventsOf({ unexpected: true })).toEqual(DEFAULT_NOTIFICATION_EVENTS);
    expect(allowsNotification(["MENTION"], "TASK_DUE")).toBe(false);
    expect(() => normalizeNotificationEvents(["PIPELINE_CARD_MOVED_TO_ME"])).toThrow();
  });

  it("reads the authenticated user's scoped row and falls back to all real events", async () => {
    const { prisma, controller } = setup();
    expect(await controller.read(selfRequest)).toEqual({
      userId: SELF,
      events: DEFAULT_NOTIFICATION_EVENTS,
    });
    expect(prisma.userNotificationPreference.findUnique).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: TENANT, userId: SELF } },
      select: { events: true },
    });
  });

  it("persists a canonical event list for the authenticated tenant", async () => {
    const { prisma, controller } = setup();
    expect(await controller.save(selfRequest, {
      events: ["CONVERSATION_MESSAGE_RECEIVED", "MENTION", "CONVERSATION_MESSAGE_RECEIVED"],
    })).toEqual({
      saved: true,
      userId: SELF,
      events: ["MENTION", "CONVERSATION_MESSAGE_RECEIVED"],
    });
    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledWith({
      where: { tenantId_userId: { tenantId: TENANT, userId: SELF } },
      create: {
        tenantId: TENANT,
        userId: SELF,
        events: ["MENTION", "CONVERSATION_MESSAGE_RECEIVED"],
      },
      update: { events: ["MENTION", "CONVERSATION_MESSAGE_RECEIVED"] },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects unknown events without writing anything", async () => {
    const { prisma, controller } = setup();
    await expect(controller.save(selfRequest, {
      events: ["MENTION", "PIPELINE_CARD_MOVED_TO_ME"],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userNotificationPreference.upsert).not.toHaveBeenCalled();
  });

  it("lets a tenant admin edit another member only inside the same tenant and audits it", async () => {
    const { prisma, controller } = setup();
    const events = ["MENTION"];
    expect(await controller.save(adminRequest, { userId: OTHER, events })).toMatchObject({
      saved: true,
      userId: OTHER,
      events,
    });
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { tenantId: TENANT, userId: OTHER },
      select: { id: true },
    });
    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId: { tenantId: TENANT, userId: OTHER } },
        create: expect.objectContaining({ tenantId: TENANT, userId: OTHER }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT,
        userId: SELF,
        action: "team.notification_preferences_updated",
        entityType: "user",
        entityId: OTHER,
        details: { events },
      },
    });
  });

  it("does not let a regular attendant edit someone else's preferences", async () => {
    const { prisma, controller } = setup();
    await expect(controller.save(selfRequest, { userId: OTHER, events: [] }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userNotificationPreference.upsert).not.toHaveBeenCalled();
  });

  it("rejects a target who is not a member of the caller's tenant", async () => {
    const { prisma, controller } = setup();
    prisma.membership.findFirst.mockResolvedValue(null);
    await expect(controller.read(adminRequest, OTHER)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userNotificationPreference.findUnique).not.toHaveBeenCalled();
  });
});
