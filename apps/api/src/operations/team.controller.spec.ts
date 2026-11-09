import { ForbiddenException } from "@nestjs/common";
jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed-password") }));
import { TeamController } from "./team.controller";

describe("TeamController password reset authorization", () => {
  const targetId = "target-user";
  const baseRequest = {
    user: {
      sub: "tenant-admin",
      tenantId: "tenant-a",
      role: "OWNER",
      isPlatformAdmin: false,
    },
  } as any;

  function createController(targetIsPlatformAdmin: boolean, actorIsPlatformAdmin = false) {
    const tx = {
      $queryRaw: jest.fn(),
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          id: "membership-1",
          user: { isPlatformAdmin: targetIsPlatformAdmin },
        }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      pushSubscription: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const events = { publish: jest.fn() };
    const controller = new TeamController(prisma as any, events as any);
    const request = {
      ...baseRequest,
      user: { ...baseRequest.user, isPlatformAdmin: actorIsPlatformAdmin },
    } as any;
    return { controller, request, tx };
  }

  it("blocks OWNER/ADMIN reset of a platform administrator through team/:id/reset-password", async () => {
    const { controller, request, tx } = createController(true);

    await expect(controller.resetPassword(request, targetId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });

  it("allows a platform administrator to reset a platform administrator password", async () => {
    const { controller, request, tx } = createController(true, true);

    await expect(controller.resetPassword(request, targetId)).resolves.toMatchObject({
      reset: true,
      mustChangePassword: true,
    });
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: targetId } });
  });
});
