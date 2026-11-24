import { WahaWebhookController } from "./waha-webhook.controller";

const TENANT = "22222222-2222-4222-8222-222222222222";
const CHANNEL_ID = "33333333-3333-4333-8333-333333333333";
const CHAT_ID = "556699999999@c.us";

function fixture(handlingMode: "BOT" | "HUMAN" = "HUMAN", intelligenceEnabled = false) {
  const channel = {
    id: CHANNEL_ID,
    tenantId: TENANT,
    sessionName: "default",
    provider: "WAHA",
    isActive: true,
  };
  const contact = {
    id: "contact-1",
    name: "Ana",
    phone: "556699999999",
    externalId: CHAT_ID,
    metadata: {},
  };
  const conversation = {
    id: "conversation-1",
    handlingMode,
    botState: null,
  };
  const savedMessage = {
    id: "message-1",
    content: "Olá",
    contentType: "text",
    status: "RECEIVED",
    direction: "INBOUND",
    occurredAt: new Date("2026-11-24T12:00:00.000Z"),
  };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    contactIdentity: {
      findUnique: jest.fn().mockResolvedValue({ id: "identity-1", contact }),
      update: jest.fn().mockResolvedValue({ id: "identity-1", contact }),
    },
    contact: { update: jest.fn().mockResolvedValue(contact) },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(conversation),
      update: jest.fn().mockResolvedValue(conversation),
    },
    message: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(savedMessage),
      update: jest.fn().mockResolvedValue(savedMessage),
    },
  };
  const prisma: any = {
    channelConnection: { findFirst: jest.fn().mockResolvedValue(channel) },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        integrations: intelligenceEnabled ? { intelligencePublished: { active: true } } : {},
      }),
    },
    message: {
      create: jest.fn().mockResolvedValue({
        id: "message-2",
        direction: "OUTBOUND",
        status: "QUEUED",
        content: "Olá",
      }),
      update: jest.fn().mockResolvedValue({
        id: "message-2",
        direction: "OUTBOUND",
        status: "SENT",
        content: "Olá",
        occurredAt: new Date("2026-11-24T12:01:00.000Z"),
      }),
    },
    conversation: { update: jest.fn().mockResolvedValue(conversation) },
    $transaction: jest.fn((callback: any) => callback(tx)),
  };
  const waha: any = {
    verifyWebhookToken: jest.fn().mockReturnValue(true),
    resolveContactPhone: jest.fn().mockResolvedValue(null),
    contactName: jest.fn().mockResolvedValue(null),
    contactPicture: jest.fn().mockResolvedValue(null),
    markSeen: jest.fn().mockResolvedValue(undefined),
    sendText: jest.fn().mockResolvedValue("provider-message-1"),
  };
  const events: any = { publish: jest.fn() };
  const engine: any = { receive: jest.fn().mockResolvedValue(true) };
  const distribution: any = { assign: jest.fn().mockResolvedValue(undefined) };
  const asaas: any = {};
  const controller = new WahaWebhookController(prisma, waha, events, asaas, engine, distribution);
  return { controller, prisma, waha, events, engine, distribution, tx, channel, contact, conversation, savedMessage };
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    event: "message",
    session: "default",
    payload: {
      id: "true_556699999999@c.us_AAA",
      from: CHAT_ID,
      body: "Olá",
      pushName: "Ana",
      timestamp: 1763983200,
      ...overrides,
    },
  };
}

describe("WAHA inbound characterization", () => {
  it("ignores WAHA echoes from the bot without touching the database or events", async () => {
    const { controller, prisma, events } = fixture();
    const result = await controller.receive(CHANNEL_ID, "token", envelope({ fromMe: true }));
    expect(result).toEqual({ ok: true, ignored: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("persists human-owned inbound but never runs the bot or marks it seen", async () => {
    const { controller, waha, events, engine, tx } = fixture("HUMAN");
    const result = await controller.receive(CHANNEL_ID, "token", envelope());
    expect(result).toEqual({ ok: true });

    expect(tx.contactIdentity.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId_provider_externalId: expect.objectContaining({ tenantId: TENANT }),
        }),
      }),
    );
    expect(tx.conversation.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT);
    expect(tx.message.create.mock.calls[0][0].data.tenantId).toBe(TENANT);
    expect(tx.message.create.mock.calls[0][0].data.direction).toBe("INBOUND");

    expect(events.publish).toHaveBeenCalledWith(
      TENANT,
      "message.received",
      expect.objectContaining({ conversationId: "conversation-1" }),
    );
    expect(engine.receive).not.toHaveBeenCalled();
    expect(waha.markSeen).not.toHaveBeenCalled();
    expect(waha.sendText).not.toHaveBeenCalled();
  });

  it("keeps publishing message.received for bot-owned inbound and delegates to the engine", async () => {
    const { controller, waha, events, engine } = fixture("BOT");
    const result = await controller.receive(CHANNEL_ID, "token", envelope());
    expect(result).toEqual({ ok: true });
    expect(engine.receive).toHaveBeenCalledWith(
      expect.objectContaining({ id: CHANNEL_ID, tenantId: TENANT }),
      "conversation-1",
      "message-1",
    );
    expect(waha.markSeen).toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(TENANT, "message.received", expect.anything());
    expect(events.publish).not.toHaveBeenCalledWith(TENANT, "message.queued", expect.anything());
  });

  it("marks bot outbound rows and emits only send lifecycle events", async () => {
    const { controller, prisma, waha, events, channel } = fixture();
    await (controller as any).sendBotReply(channel, CHAT_ID, "conversation-1", "Olá");
    expect(prisma.message.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        tenantId: TENANT,
        direction: "OUTBOUND",
        metadata: expect.objectContaining({ bot: true }),
      }),
    );
    const topics = events.publish.mock.calls.map((call: any[]) => call[1]);
    expect(topics).toEqual(["message.queued", "message.sent"]);
    expect(topics).not.toContain("message.received");
    expect(waha.sendText).toHaveBeenCalled();
  });
});
