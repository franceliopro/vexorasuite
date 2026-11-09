import { EventsAuthorizationService } from "./events-authorization.service";

describe("EventsAuthorizationService", () => {
  const user = {
    sub: "user-a",
    tenantId: "tenant-a",
    tenantSlug: "tenant-a",
    role: "AGENT" as const,
    sessionVersion: 3,
  };

  const member = {
    role: "AGENT",
    modules: ["INBOX"],
    deniedModules: [],
    user: { authVersion: 3, isPlatformAdmin: false },
    tenant: { kind: "COMPANY", integrations: {} },
  };

  it("rechecks membership and denies immediately after session revocation", async () => {
    const prisma: any = {
      membership: {
        findFirst: jest.fn().mockResolvedValueOnce(member).mockResolvedValueOnce(null),
      },
      departmentMember: {
        findMany: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.departmentMember.findMany.mockResolvedValue([
      { department: { id: "department-a", modules: ["INBOX"] } },
    ]);
    const service = new EventsAuthorizationService(prisma);

    await expect(service.authorize(user, { type: "channel.status", data: {} })).resolves.toEqual({
      type: "channel.status",
      data: {},
    });
    await expect(service.authorize(user, { type: "channel.status", data: {} })).resolves.toBeNull();
  });

  it("always scopes resource authorization to the authenticated tenant", async () => {
    const prisma: any = {
      membership: { findFirst: jest.fn().mockResolvedValue(member) },
      departmentMember: {
        findMany: jest.fn().mockResolvedValue([
          { department: { id: "department-a", modules: ["INBOX"] } },
        ]),
      },
      conversation: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new EventsAuthorizationService(prisma);

    await expect(
      service.authorize(user, {
        type: "conversation.updated",
        data: { id: "conversation-from-another-tenant" },
      }),
    ).resolves.toBeNull();

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-a" }),
      }),
    );
  });

  it("does not authorize a session whose auth version changed", async () => {
    const prisma: any = {
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          ...member,
          user: { ...member.user, authVersion: 4 },
        }),
      },
      departmentMember: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new EventsAuthorizationService(prisma);

    await expect(service.authorize(user, { type: "channel.status", data: {} })).resolves.toBeNull();
  });
});
