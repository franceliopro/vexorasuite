import { StreamableFile } from "@nestjs/common";
import { ConversationsController } from "./conversations.controller";

describe("inbound media proxy", () => {
  const conversationId = "11111111-1111-4111-8111-111111111111";
  const messageId = "22222222-2222-4222-8222-222222222222";
  const req = { user: { tenantId: "tenant", sub: "owner", role: "OWNER" } } as never;

  function setup(provider: string, metadata: Record<string, unknown>, settings: Record<string, unknown> = {}) {
    const channel = { id: "channel", tenantId: "tenant", provider, settings, sessionName: "default" };
    const conversation = { id: conversationId, channelConnection: channel };
    const message = { id: messageId, conversationId, providerMessageId: "provider-message", metadata };
    const prisma = {
      conversation: { findFirst: jest.fn().mockResolvedValue(conversation) },
      channelConnection: { findMany: jest.fn().mockResolvedValue([]) },
      message: { findFirst: jest.fn().mockResolvedValue(message) },
    };
    const waha = { downloadMedia: jest.fn(), recoverMessageMedia: jest.fn() };
    const zernio = { downloadMedia: jest.fn().mockResolvedValue({ buffer: Buffer.from("zernio"), mimetype: "image/jpeg" }) };
    const meta = { downloadMedia: jest.fn().mockResolvedValue({ buffer: Buffer.from("meta"), mimetype: "image/png" }) };
    const controller = new ConversationsController(prisma as never, { publish: jest.fn() } as never, waha as never, zernio as never, null as never, meta as never);
    return { controller, waha, zernio, meta };
  }

  it("returns an honest placeholder error instead of a broken provider link", async () => {
    const { controller, waha, zernio, meta } = setup("ZERNIO", {
      hasMedia: true,
      mediaUrl: "https://evil.example/secret",
      mediaDelivery: "UNAVAILABLE",
      filename: "foto.jpg",
      mimetype: "image/jpeg",
      contentType: "image",
    });
    await expect(controller.messageMedia(req, conversationId, messageId)).rejects.toMatchObject({
      response: { placeholder: { filename: "foto.jpg", mimetype: "image/jpeg", contentType: "image" } },
    });
    expect(waha.downloadMedia).not.toHaveBeenCalled();
    expect(zernio.downloadMedia).not.toHaveBeenCalled();
    expect(meta.downloadMedia).not.toHaveBeenCalled();
  });

  it("resolves Meta media by id with the tenant token on the server", async () => {
    const { controller, meta } = setup("META", { hasMedia: true, mediaRef: "abcDEF123", mediaDelivery: "READY" }, { phoneNumberId: "123456789" });
    const result = await controller.messageMedia(req, conversationId, messageId);
    expect(result).toBeInstanceOf(StreamableFile);
    expect(meta.downloadMedia).toHaveBeenCalledWith("tenant", "abcDEF123", "123456789");
  });

  it("downloads Zernio media only from an allowlisted https host", async () => {
    const { controller, zernio } = setup("ZERNIO", { hasMedia: true, mediaUrl: "https://cdninstagram.com/photo.jpg", mediaDelivery: "READY" });
    await expect(controller.messageMedia(req, conversationId, messageId)).resolves.toBeInstanceOf(StreamableFile);
    expect(zernio.downloadMedia).toHaveBeenCalledWith("tenant", "https://cdninstagram.com/photo.jpg");
  });

  it("refuses arbitrary hosts received in social webhooks", async () => {
    const { controller, zernio } = setup("ZERNIO", { hasMedia: true, mediaUrl: "https://evil.example/photo.jpg", mediaDelivery: "READY" });
    await expect(controller.messageMedia(req, conversationId, messageId)).rejects.toThrow("URL de mídia segura");
    expect(zernio.downloadMedia).not.toHaveBeenCalled();
  });

  it("keeps WAHA gateway recovery scoped to the stored path", async () => {
    const waha = { downloadMedia: jest.fn().mockResolvedValue({ buffer: Buffer.from("waha"), mimetype: "image/png" }), recoverMessageMedia: jest.fn() };
    const prisma = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: conversationId, channelConnection: { id: "channel", provider: "WAHA", sessionName: "default" } }) },
      channelConnection: { findMany: jest.fn().mockResolvedValue([]) },
      message: { findFirst: jest.fn().mockResolvedValue({ id: messageId, metadata: { hasMedia: true, mediaUrl: "/api/files/chat/file.png", chatId: "chat" }, providerMessageId: "provider-message" }) },
    };
    const controller = new ConversationsController(prisma as never, { publish: jest.fn() } as never, waha as never, { downloadMedia: jest.fn() } as never, null as never);
    await expect(controller.messageMedia(req, conversationId, messageId)).resolves.toBeInstanceOf(StreamableFile);
    expect(waha.downloadMedia).toHaveBeenCalledWith(expect.objectContaining({ provider: "WAHA" }), "/api/files/chat/file.png");
  });
});
