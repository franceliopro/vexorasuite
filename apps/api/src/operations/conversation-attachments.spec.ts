import { ConversationsController } from "./conversations.controller";
import { WahaService } from "./waha.service";

describe("conversation location and contact attachments", () => {
  const user = { user: { tenantId: "tenant", sub: "agent", role: "OWNER" } } as never;
  const contact = { name: "Contato", phone: "+55 11 99999-0001", email: "contato@example.test", metadata: {} };
  const vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Contato\r\nEND:VCARD";

  function setup(platform: string) {
    const conversation = {
      id: "conversation", status: "OPEN", contact,
      channelConnection: { provider: "ZERNIO", isActive: true, settings: { platform, accountId: "official-account" } },
    };
    const prisma = {
      channelConnection: { findMany: jest.fn().mockResolvedValue([]) },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(conversation),
        update: jest.fn().mockResolvedValue(conversation),
      },
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: "Atendente" }) },
      message: {
        findFirst: jest.fn().mockResolvedValue({ metadata: { accountId: "official-account", externalConversationId: "thread" } }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "row", ...data })),
        update: jest.fn().mockResolvedValue({ id: "row", occurredAt: new Date(), status: "SENT" }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    const zernio = { request: jest.fn().mockResolvedValue({ id: "sent" }) };
    const events = { publish: jest.fn() };
    const controller = new ConversationsController(prisma as never, events as never, {} as never, zernio as never);
    return { controller, prisma, zernio };
  }

  it("sends a location pin and contact card through official WhatsApp", async () => {
    const { controller, prisma, zernio } = setup("whatsapp");
    await controller.sendMessage(user, "conversation", { kind: "location", latitude: -5.19, longitude: -37.34 });
    expect(zernio.request).toHaveBeenNthCalledWith(1, "/inbox/conversations/thread/messages",
      expect.objectContaining({ body: { accountId: "official-account", location: { latitude: -5.19, longitude: -37.34, name: "Localização" } } }), "tenant");
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ content: expect.stringContaining("google.com/maps/search") }),
    }));
    await controller.sendMessage(user, "conversation", { kind: "contact", vcard });
    expect(zernio.request).toHaveBeenNthCalledWith(2, "/inbox/conversations/thread/messages",
      expect.objectContaining({ body: { accountId: "official-account", contacts: [{
        name: { formatted_name: "Contato" }, phones: [{ phone: "+5511999990001", type: "CELL" }],
        emails: [{ email: "contato@example.test" }],
      }] } }), "tenant");
  });

  it("shares a maps link on channels that only accept text", async () => {
    const { controller, zernio } = setup("instagram");
    await controller.sendMessage(user, "conversation", { kind: "location", latitude: -5.19, longitude: -37.34 });
    expect(zernio.request).toHaveBeenCalledWith("/inbox/conversations/thread/messages",
      expect.objectContaining({ body: { accountId: "official-account", message: expect.stringContaining("google.com/maps/search") } }), "tenant");
  });

  it("wraps the vCard in the contacts array expected by WAHA", async () => {
    const waha = new WahaService({} as never);
    const send = jest.spyOn(waha as any, "sendPayload").mockResolvedValue("sent");
    await waha.sendContact({ sessionName: "default" } as never, "5511999990001@c.us", { vcard });
    expect(send).toHaveBeenCalledWith("/api/sendContactVcard", {
      session: "default", chatId: "5511999990001@c.us", contacts: [{ vcard }],
    });
  });
});
