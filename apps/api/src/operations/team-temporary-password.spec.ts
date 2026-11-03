import { compare } from "bcryptjs";
import { TeamController } from "./team.controller";

describe("team temporary passwords", () => {
  it("generates a random password when creating a team member", async () => {
    const userCreate = jest.fn().mockResolvedValue({ id: "user-1", name: "Ana", email: "ana@example.com" });
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: any) => callback({
        department: { count: jest.fn().mockResolvedValue(0) },
        user: { create: userCreate },
        membership: { create: jest.fn() },
        departmentMember: { createMany: jest.fn() },
        auditLog: { create: jest.fn() },
      })),
    };
    const events = { publish: jest.fn() };
    const controller = new TeamController(prisma, events as any);
    const request: any = { user: { role: "ADMIN", tenantId: "tenant-1", sub: "admin-1", isPlatformAdmin: false, allowedModules: [] } };
    const result = await controller.create(request, { name: "Ana", email: "ana@example.com", departmentIds: [] });

    expect(result.temporaryPassword).toMatch(/^Vx![A-Za-z0-9_-]{32}$/);
    expect(result.temporaryPassword).not.toBe("Senha@123");
    await expect(compare(result.temporaryPassword, userCreate.mock.calls[0][0].data.passwordHash)).resolves.toBe(true);
  });

  it("returns a random password after resetting a team member", async () => {
    const userUpdate = jest.fn().mockResolvedValue({});
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback({
        $queryRaw: jest.fn(),
        membership: { findFirst: jest.fn().mockResolvedValue({ id: "membership-1" }) },
        user: { update: userUpdate },
        pushSubscription: { deleteMany: jest.fn() },
        auditLog: { create: jest.fn() },
      })),
    };
    const controller = new TeamController(prisma, { publish: jest.fn() } as any);
    const request: any = { user: { role: "ADMIN", tenantId: "tenant-1", sub: "admin-1", isPlatformAdmin: false } };
    const result = await controller.resetPassword(request, "user-1");

    expect(result.temporaryPassword).toMatch(/^Vx![A-Za-z0-9_-]{32}$/);
    expect(result.temporaryPassword).not.toBe("Senha@123");
    await expect(compare(result.temporaryPassword, userUpdate.mock.calls[0][0].data.passwordHash)).resolves.toBe(true);
  });
});
