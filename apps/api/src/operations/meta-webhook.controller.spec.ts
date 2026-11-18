import { createHmac, randomBytes } from "node:crypto";
process.env.JWT_ACCESS_SECRET = "vexora-meta-webhook-spec-secret";
import { MetaWebhookController } from "./meta-webhook.controller";
import { encryptMetaCredential } from "./meta-credentials";

const tenantId = "tenant-meta-1";
const secret = "meta-spec-app-secret";
const verifyToken = "meta-spec-verify-token";
const channelRow = {
  id: "0b7a5c84-89c2-4e1d-bb21-7e5d155b2c2d",
  tenantId,
  provider: "META",
  isActive: true,
  name: "Oficial",
  sessionName: "meta-spec",
  status: "CONNECTED",
  lastError: null,
  settings: { phoneNumberId: "123456789012345" },
} as any;
const integrations = {
  metaCredentials: {
    accessToken: { encryptedKey: encryptMetaCredential(tenantId, "accessToken", "spec-access-token-that-is-long-enough-to-pass-validation-checks-ok") },
    appSecret: { encryptedKey: encryptMetaCredential(tenantId, "appSecret", secret) },
    verifyToken: { encryptedKey: encryptMetaCredential(tenantId, "verifyToken", verifyToken) },
  },
};

function makePrisma() {
  const contactRow: any = { id: "contact-1", tenantId, name: "Ana", phone: "5566999998888", externalId: "5566999998888", metadata: {} };
  const conversationRow: any = { id: "conversation-1", tenantId, contactId: contactRow.id, channelConnectionId: channelRow.id, status: "OPEN", handlingMode: "HUMAN", archivedAt: null, deletedAt: null };
  const tx: any = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    contactIdentity: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
    contact: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async (args: any) => ({ id: "contact-1", ...contactRow, ...args.data })), update: jest.fn().mockImplementation(async (args: any) => ({ ...contactRow, ...args.data })) },
    conversation: { findFirst: jest.fn().mockResolvedValue(conversationRow), create: jest.fn().mockResolvedValue(conversationRow), update: jest.fn().mockResolvedValue(conversationRow) },
    message: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async (args: any) => ({ id: "message-1", ...args.data })) },
  };
  return {
    store: { contactRow, conversationRow, tx },
    prisma: {
      channelConnection: { findFirst: jest.fn().mockResolvedValue(channelRow) },
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ integrations }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
      message: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "message-1" }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as any,
  };
}

const resMock = () => {
  const res: any = { setHeader: jest.fn(), send: jest.fn() };
  return res;
};

describe("Meta (WhatsApp Cloud API) webhook", () => {
  it("answers the verification handshake with the challenge", async () => {
    const { prisma } = makePrisma();
    const events: any = { publish: jest.fn() };
    const intelligence: any = { receive: jest.fn() };
    const meta: any = { markSeen: jest.fn() };
    const controller = new MetaWebhookController(prisma, meta, events, intelligence);
    const res = resMock();
    await controller.verify(
      channelRow.id,
      "subscribe",
      verifyToken,
      "challenge-123",
      res,
    );
    expect(res.send).toHaveBeenCalledWith("challenge-123");
  });

  it("rejects a POST with an invalid signature", async () => {
    const { prisma } = makePrisma();
    const events: any = { publish: jest.fn() };
    const intelligence: any = { receive: jest.fn() };
    const meta: any = { markSeen: jest.fn() };
    const controller = new MetaWebhookController(prisma, meta, events, intelligence);
    const payload = { object: "whatsapp_business_account", entry: [] };
    const raw = Buffer.from(JSON.stringify(payload));
    const req: any = { rawBody: raw, headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) } };
    await expect(controller.receive(channelRow.id, req, payload)).rejects.toThrow();
  });

  it("accepts a signed text message and persists it as inbound", async () => {
    const { prisma, store } = makePrisma();
    const events: any = { publish: jest.fn() };
    const intelligence: any = { receive: jest.fn() };
    const meta: any = { markSeen: jest.fn() };
    const controller = new MetaWebhookController(prisma, meta, events, intelligence);
    const payload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "waba-1",
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "5511000000000", phone_number_id: "123456789012345" },
            contacts: [{ profile: { name: "Ana" }, wa_id: "5566999998888" }],
            messages: [{ from: "5566999998888", id: "wamid.test-123", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Oi, preciso de ajuda" } }],
          },
        }],
      }],
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const signature = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    const req: any = { rawBody: raw, headers: { "x-hub-signature-256": signature } };
    await controller.receive(channelRow.id, req, payload);
    expect(events.publish).toHaveBeenCalledWith(
      tenantId,
      "message.received",
      expect.objectContaining({ conversationId: "conversation-1" }),
    );
    expect(store.tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: "INBOUND", content: "Oi, preciso de ajuda", providerMessageId: "wamid.test-123" }) }),
    );
  });
});
