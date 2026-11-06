import { ConversationsController } from "./conversations.controller";

describe("conversation lifecycle audit", () => {
  const request: any = { user: { tenantId: "tenant", sub: "agent", role: "OWNER" } };

  function setup() {
    const tx: any = {
      conversation: {
        update: jest.fn().mockResolvedValue({ id: "conversation", status: "RESOLVED", handlingMode: "BOT", departmentId: null, assigneeId: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      conversationParticipant: { upsert: jest.fn().mockResolvedValue({ id: "participant" }) },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: "conversation", status: "OPEN", contactId: "contact", handlingMode: "HUMAN", contact: { metadata: {} } }) },
      contact: { findFirst: jest.fn().mockResolvedValue({ metadata: {} }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const events: any = { publish: jest.fn() };
    return { tx, prisma, controller: new ConversationsController(prisma, events, {} as any, {} as any) };
  }

  it("audits status transitions with the previous and next status", async () => {
    const x = setup();
    await x.controller.updateStatus(request, "conversation", "RESOLVED");
    expect(x.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "conversation.status_changed",
        details: { from: "OPEN", to: "RESOLVED", contactId: "contact" },
      }),
    }));
  });

  it("audits returning an atendimento to the bot", async () => {
    const x = setup();
    await x.controller.returnToBot(request, "conversation");
    expect(x.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "conversation.returned_to_bot",
        details: { from: "HUMAN", to: "BOT" },
      }),
    }));
  });

  it.each([
    ["archive", "conversation.archived"],
    ["restore", "conversation.restored"],
    ["trash", "conversation.trashed"],
  ])("audits %s lifecycle changes", async (operation, action) => {
    const x = setup();
    await (x.controller as any)[operation](request, "conversation");
    expect(x.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action }) }));
  });

  it.each([
    ["assume", "conversation.assumed"],
    ["assign", "conversation.assigned"],
    ["invite", "conversation.participant_invited"],
  ])("audits collaboration action %s", async (operation, action) => {
    const x = setup();
    if (operation === "assign") {
      x.prisma.membership = { findFirst: jest.fn().mockResolvedValue({ id: "membership" }) };
      await (x.controller as any)[operation](request, "conversation", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    }
    else if (operation === "invite") {
      x.prisma.membership = { findFirst: jest.fn().mockResolvedValue({ id: "membership" }) };
      x.tx.conversationParticipant.upsert.mockResolvedValue({ id: "participant" });
      await (x.controller as any)[operation](request, "conversation", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    } else {
      x.prisma.membership = { findFirst: jest.fn().mockResolvedValue({ id: "membership" }) };
      await (x.controller as any)[operation](request, "conversation");
    }
    expect(x.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action }) }));
  });
});
