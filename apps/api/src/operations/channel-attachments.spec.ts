import { ChannelConnectionsController } from "./channels.controller";

describe("channel attachment purposes", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const req = { user: { tenantId: "tenant", sub: "owner", role: "OWNER" } } as never;

  function setup(provider = "WAHA") {
    const channel = { id, tenantId: "tenant", provider, isActive: true };
    const prisma = {
      channelConnection: { findFirst: jest.fn().mockResolvedValue(channel) },
      channelAttachment: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const events = { publish: jest.fn() };
    const controller = new ChannelConnectionsController(prisma as never, {} as never, events as never, {} as never);
    return { controller, prisma, events, channel };
  }

  it.each(["WAHA", "ZERNIO", "META"])("persists every supported purpose for %s", async (provider) => {
    const { controller, prisma, events } = setup(provider);
    for (const service of ["INBOX", "IA", "CHATBOT", "SITE"]) {
      await expect(controller.updateAttachments(req, id, { service, attached: true })).resolves.toEqual({ id, service, attached: true });
    }
    expect(prisma.channelConnection.findFirst).toHaveBeenCalledWith({
      where: { id, tenantId: "tenant", provider: { in: ["WAHA", "ZERNIO", "META"] }, isActive: true },
      select: { id: true },
    });
    expect(prisma.channelAttachment.upsert).toHaveBeenCalledTimes(4);
    expect(events.publish).toHaveBeenCalledTimes(4);
    expect(events.publish).toHaveBeenCalledWith("tenant", "channel.attachments.updated", { id, service: "SITE", attached: true });
  });

  it("does not expose purpose toggles for providers without a supported inbox", async () => {
    const { controller, prisma } = setup("EMAIL");
    prisma.channelConnection.findFirst.mockResolvedValue(null);
    await expect(controller.updateAttachments(req, id, { service: "INBOX", attached: true })).rejects.toThrow("Canal não encontrado");
    expect(prisma.channelAttachment.upsert).not.toHaveBeenCalled();
  });

  it("rejects unknown services and non-boolean values before touching the database", async () => {
    const { controller, prisma } = setup();
    await expect(controller.updateAttachments(req, id, { service: "UNKNOWN", attached: true })).rejects.toThrow("service deve ser");
    await expect(controller.updateAttachments(req, id, { service: "IA", attached: "yes" })).rejects.toThrow("attached deve ser booleano");
    expect(prisma.channelAttachment.upsert).not.toHaveBeenCalled();
  });
});
