import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { ZernioWebhookController } from "./zernio-webhook.controller";

describe("Zernio message delivery receipts", () => {
  const tenantId = "tenant-a";
  const channelId = "channel-a";

  function setup(candidates: { id: string; conversationId: string }[], count = 1) {
    const prisma = {
      channelConnection: {
        findFirst: jest.fn().mockResolvedValue({
          id: channelId,
          tenantId,
          status: "CONNECTED",
          settings: { accountId: "account-a", webhookVerifiedAt: "verified" },
        }),
      },
      message: {
        findMany: jest.fn().mockResolvedValue(candidates),
        updateMany: jest.fn().mockResolvedValue({ count }),
      },
    };
    const events = { publish: jest.fn() };
    const controller = new ZernioWebhookController(prisma as never, events as never, {
      verifyWebhook: jest.fn().mockReturnValue(true),
    } as never, {} as never);
    const receive = (event: string) => controller.receive(channelId, {
      headers: {},
      body: {
        event,
        account: { accountId: "account-a" },
        message: { id: "zernio-id", platformMessageId: "meta-id" },
      },
    } as RawBodyRequest<Request>);
    return { prisma, events, receive };
  }

  it("reconciles a read receipt only for an outgoing message on the linked channel", async () => {
    const { prisma, events, receive } = setup([{ id: "message-a", conversationId: "conversation-a" }]);
    await expect(receive("message.read")).resolves.toEqual({ ok: true, accepted: true });
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId, direction: "OUTBOUND", conversation: { channelConnectionId: channelId },
        providerMessageId: { in: ["zernio-id", "meta-id"] },
      },
    }));
    expect(events.publish).toHaveBeenCalledWith(tenantId, "message.status", {
      conversationId: "conversation-a", messageId: "message-a", status: "READ",
    });
  });

  it("does not replace confirmed delivery with a later failure or notify on a no-op", async () => {
    const { prisma, events, receive } = setup([{ id: "message-a", conversationId: "conversation-a" }], 0);
    await expect(receive("message.failed")).resolves.toEqual({ ok: true, accepted: false });
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { id: "message-a", tenantId, status: { in: ["QUEUED", "SENT"] } },
      data: { status: "FAILED" },
    });
    expect(events.publish).not.toHaveBeenCalled();
  });
});
