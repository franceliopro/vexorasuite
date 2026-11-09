import { WahaWebhookController } from "./waha-webhook.controller";

describe("guided chatbot handoff context", () => {
  it("stores an internal context note without calling a channel adapter", async () => {
    const tx: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ contact: { name: "Ana", phone: "556699999999" } }) },
      message: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ content: "Preciso de suporte" }),
        create: jest.fn().mockResolvedValue({ id: "context" }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    const controller = new WahaWebhookController(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    await (controller as any).recordGuidedHandoffContext("tenant", "conversation", "SUPORTE", "RASTREABEM", "Suporte · Rastreabem", "Suporte");
    expect(tx.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direction: "INTERNAL", senderName: "Contexto do atendimento", metadata: expect.objectContaining({ kind: "guided_handoff_context" }) }) }));
    expect(tx.message.create.mock.calls[0][0].data.content).toContain("Última mensagem do cliente: Preciso de suporte");
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "conversation.guided_handoff_context" }) }));
  });

  it("does not duplicate the guided context note", async () => {
    const tx: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ contact: { name: "Ana", phone: "556699999999" } }) },
      message: { findFirst: jest.fn().mockResolvedValue({ metadata: { kind: "guided_handoff_context" } }), create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    const controller = new WahaWebhookController(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    await (controller as any).recordGuidedHandoffContext("tenant", "conversation", "SUPORTE", null, "Suporte", "Suporte");
    expect(tx.message.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
