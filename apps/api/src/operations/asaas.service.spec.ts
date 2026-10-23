import { PrismaService } from "../prisma/prisma.service";
import { AsaasService } from "./asaas.service";

describe("AsaasService webhook reconciliation", () => {
  const existingPayment = {
    id: "payment-local-id",
    tenantId: "tenant-id",
    conversationId: "conversation-id",
    contactId: "contact-id",
    provider: "ASAAS",
    externalId: "pay_123",
    amount: 125,
    status: "PAID",
    environment: "PRODUCTION",
    conversation: { contact: {}, channelConnection: null },
  };

  function setup() {
    const prisma = {
      payment: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(existingPayment)
          .mockResolvedValue({ ...existingPayment, status: "CANCELLED" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      message: { create: jest.fn().mockResolvedValue({ id: "message-id" }) },
    } as unknown as PrismaService;
    const service = new AsaasService(prisma);
    jest.spyOn(service as any, "settings").mockResolvedValue({ sandbox: false });
    return { service, prisma };
  }

  it("records a refund even when the payment was previously marked paid", async () => {
    const { service, prisma } = setup();

    const result = await service.settleWebhook("tenant-id", {
      event: "PAYMENT_REFUNDED",
      payment: { id: "pay_123", value: 125 },
    });

    expect((prisma as any).payment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-local-id", tenantId: "tenant-id", status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" },
    });
    expect(result).toMatchObject({ paid: false, payment: { status: "CANCELLED" } });
    expect((prisma as any).message.create).not.toHaveBeenCalled();
  });

  it("ignores duplicate payment-confirmation events", async () => {
    const { service, prisma } = setup();

    const result = await service.settleWebhook("tenant-id", {
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_123", value: 125 },
    });

    expect(result).toBeNull();
    expect((prisma as any).payment.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).message.create).not.toHaveBeenCalled();
  });
});
