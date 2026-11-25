import { ConversationsController } from "./conversations.controller";

describe("inbox attachment scope", () => {
  const req = { user: { tenantId: "tenant", sub: "owner", role: "OWNER" } } as never;

  function setup(attachedIds: string[]) {
    const prisma = {
      conversation: { findMany: jest.fn().mockResolvedValue([]) },
      channelConnection: { findMany: jest.fn().mockResolvedValue(attachedIds.map(id => ({ id }))) },
      membership: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const controller = new ConversationsController(prisma as never, { publish: jest.fn() } as never, {} as never, {} as never, null as never);
    return { controller, prisma };
  }

  it("keeps automation-only and unattached channels out of human queues", async () => {
    const { controller, prisma } = setup([]);
    await controller.list(req, "all-open");
    expect(prisma.channelConnection.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant", attachments: { some: { service: "INBOX", attached: true } } },
      select: { id: true },
    });
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ channelConnectionId: null }, { channelConnectionId: { in: [] } }] }),
    }));
  });

  it("shows only channels explicitly attached to Atendimento", async () => {
    const { controller, prisma } = setup(["human-channel"]);
    await controller.list(req, "all-open");
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [{ channelConnectionId: null }, { channelConnectionId: { in: ["human-channel"] } }] }),
    }));
  });
});
