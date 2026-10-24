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


describe("AsaasService CRM customer synchronization", () => {
  const contact = {
    id: "contact-won",
    tenantId: "tenant-id",
    name: "Cliente de teste",
    phone: "11987654321",
    email: "cliente@example.com",
    metadata: {
      contactType: "CUSTOMER",
      document: "52998224725",
      crmFinalization: { outcome: "WON" },
    },
  };

  function setupContact() {
    const prisma = {
      contact: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(contact)
          .mockResolvedValue({ metadata: contact.metadata }),
        update: jest.fn().mockResolvedValue({ id: contact.id }),
      },
    } as unknown as PrismaService;
    const service = new AsaasService(prisma);
    jest.spyOn(service as any, "credentials").mockResolvedValue({ key: "test", sandbox: true });
    const request = jest.spyOn(service as any, "request");
    return { service, prisma, request };
  }

  it("links an existing Asaas customer by exact document instead of creating a duplicate", async () => {
    const { service, prisma, request } = setupContact();
    request.mockResolvedValueOnce({ data: [{ id: "cus_existing", cpfCnpj: "52998224725" }], hasMore: false });

    const result = await service.syncCustomerByContact("tenant-id", "contact-won");

    expect(result).toEqual({ status: "SYNCED", customerId: "cus_existing" });
    expect(request).toHaveBeenCalledTimes(1);
    expect((prisma as any).contact.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "contact-won" },
      data: { metadata: expect.objectContaining({
        contactType: "CUSTOMER",
        asaas: expect.objectContaining({ customerId: "cus_existing", environment: "SANDBOX", status: "ACTIVE" }),
        asaasSync: expect.objectContaining({ status: "SYNCED" }),
      }) },
    }));
  });

  it("creates the Asaas customer when no exact document match exists", async () => {
    const { service, request } = setupContact();
    request.mockResolvedValueOnce({ data: [], hasMore: false }).mockResolvedValueOnce({ id: "cus_created", name: "Cliente de teste" });

    const result = await service.syncCustomerByContact("tenant-id", "contact-won");

    expect(result).toEqual({ status: "SYNCED", customerId: "cus_created" });
    expect(request).toHaveBeenNthCalledWith(2, "tenant-id", "/customers", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Cliente de teste", externalReference: "vexora:contact-won", cpfCnpj: "52998224725", email: "cliente@example.com", mobilePhone: "11987654321" }),
    }));
  });
});
