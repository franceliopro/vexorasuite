import { ForbiddenException } from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService password reset authorization", () => {
  const targetId = "target-user";

  function createService(targetIsPlatformAdmin: boolean) {
    const prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({
          id: "membership-1",
          user: { isPlatformAdmin: targetIsPlatformAdmin },
        }),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    return { service: new AuthService(prisma as any, {} as any), prisma };
  }

  it("blocks OWNER/ADMIN reset of a platform administrator through auth/users/:id/reset-password", async () => {
    const { service, prisma } = createService(true);

    await expect(
      service.resetUserPassword("tenant-a", "ADMIN", false, targetId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows a platform administrator to reset a platform administrator password", async () => {
    const { service, prisma } = createService(true);

    await expect(
      service.resetUserPassword("platform-tenant", "OWNER", true, targetId),
    ).resolves.toMatchObject({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetId },
        data: expect.objectContaining({
          mustChangePassword: true,
          authVersion: { increment: 1 },
        }),
      }),
    );
  });
});
