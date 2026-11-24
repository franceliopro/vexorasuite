import { NotificationSettingsController } from "./notification-settings.controller";

describe("notification settings", () => {
  it("always reports botNotifications as false, even if tenant data claims otherwise", async () => {
    const prisma: any = {
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          integrations: { notificationRouting: { users: true, departments: true, botNotifications: true } },
        }),
      },
    };
    const controller = new NotificationSettingsController(prisma);
    const settings = await controller.read({
      user: { tenantId: "22222222-2222-4222-8222-222222222222", role: "OWNER" },
    } as any);
    expect(settings).toEqual({ users: true, departments: true, botNotifications: false });
    expect(prisma.tenant.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "22222222-2222-4222-8222-222222222222" },
      select: { integrations: true },
    });
  });
});
