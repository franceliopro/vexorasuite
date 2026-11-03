import { compare } from "bcryptjs";
import { AuthService } from "./auth.service";

describe("temporary administrative passwords", () => {
  const throttle = { assertAllowed: jest.fn(), recordFailure: jest.fn(), clear: jest.fn() };
  const jwt = {} as any;

  it("generates a unique temporary password for a new user", async () => {
    const created = { id: "user-1", name: "Ana", email: "ana@example.com", avatarUrl: null };
    const userCreate = jest.fn().mockResolvedValue(created);
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback({
        user: { create: userCreate },
        membership: { create: jest.fn() },
      })),
    };
    const service = new AuthService(prisma, jwt, throttle as any);
    const result = await service.createUser("tenant-1", "OWNER", false, {
      name: "Ana",
      email: "ana@example.com",
      role: "AGENT",
    });

    expect(result.temporaryPassword).toMatch(/^Vx![A-Za-z0-9_-]{32}$/);
    expect(result.temporaryPassword).not.toBe("Senha@123");
    await expect(compare(result.temporaryPassword, userCreate.mock.calls[0][0].data.passwordHash)).resolves.toBe(true);
  });

  it("generates a new temporary password when resetting a user", async () => {
    const userUpdate = jest.fn().mockResolvedValue({});
    const prisma: any = {
      membership: { findUnique: jest.fn().mockResolvedValue({ id: "membership-1" }) },
      user: { update: userUpdate },
    };
    const service = new AuthService(prisma, jwt, throttle as any);
    const result = await service.resetUserPassword("tenant-1", "ADMIN", false, "user-1");

    expect(result.temporaryPassword).toMatch(/^Vx![A-Za-z0-9_-]{32}$/);
    expect(result.temporaryPassword).not.toBe("Senha@123");
    await expect(compare(result.temporaryPassword, userUpdate.mock.calls[0][0].data.passwordHash)).resolves.toBe(true);
  });
});
