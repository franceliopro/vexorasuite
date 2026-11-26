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
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(prisma)),
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
      auditLog: { create: jest.fn() },
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
    request.mockResolvedValueOnce({ data: [], hasMore: false }).mockResolvedValueOnce({ data: [{ id: "cus_existing", cpfCnpj: "52998224725" }], hasMore: false });

    const result = await service.syncCustomerByContact("tenant-id", "contact-won");

    expect(result).toEqual({ status: "SYNCED", customerId: "cus_existing" });
    expect(request).toHaveBeenCalledTimes(2);
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
    request.mockResolvedValueOnce({ data: [], hasMore: false }).mockResolvedValueOnce({ data: [], hasMore: false }).mockResolvedValueOnce({ id: "cus_created", name: "Cliente de teste" });

    const result = await service.syncCustomerByContact("tenant-id", "contact-won");

    expect(result).toEqual({ status: "SYNCED", customerId: "cus_created" });
    expect(request).toHaveBeenNthCalledWith(3, "tenant-id", "/customers", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Cliente de teste", externalReference: "vexora:contact-won", cpfCnpj: "52998224725", email: "cliente@example.com", mobilePhone: "11987654321" }),
    }));
  });
});


describe("AsaasService assinaturas a partir do catálogo", () => {
  const catalogId = "11111111-1111-4111-8111-111111111111";

  function setupPayment() {
    const prisma: any = {
      catalogItem: {
        findFirst: jest.fn().mockResolvedValue({ id: catalogId, name: "Plano mensal", priceCents: 12900, currency: "BRL", category: "PRODUCT" }),
        findMany: jest.fn().mockResolvedValue([{ id: catalogId, name: "Plano mensal", priceCents: 12900, description: "", imageUrl: null, createdAt: new Date("2026-01-01T00:00:00.000Z") }]),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      contact: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(prisma)),
    };
    const service = new AsaasService(prisma as PrismaService);
    jest.spyOn(service as any, "credentials").mockResolvedValue({ key: "test", sandbox: false });
    const request = jest.spyOn(service as any, "request").mockResolvedValue({ id: "sub_test", description: "Plano mensal", value: 129, nextDueDate: "2026-12-01", endDate: "2027-11-30" });
    return { service, prisma, request };
  }

  it("usa nome e preço gravados no catálogo, qualquer que seja a categoria", async () => {
    const { service, prisma, request } = setupPayment();

    const result = await service.createSubscription("tenant-id", {
      customerId: "cus_test", catalogItemId: catalogId, value: 1, service: "Nome inventado",
      cycle: "MONTHLY", billingType: "PIX", nextDueDate: "2026-12-01", endDate: "2027-11-30", userId: "user-1",
    });

    expect(request).toHaveBeenCalledWith("tenant-id", "/subscriptions", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        customer: "cus_test", billingType: "PIX", value: 129, cycle: "MONTHLY",
        nextDueDate: "2026-12-01", description: "Plano mensal", externalReference: undefined, endDate: "2027-11-30",
      }),
    }));
    expect(result.subscription).toMatchObject({ id: "sub_test", catalogItemId: catalogId, endDate: "2027-11-30" });
    expect(prisma.catalogItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: catalogId, tenantId: "tenant-id", active: true },
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "payment.subscription_created", details: expect.objectContaining({ catalogItemId: catalogId, endDate: "2027-11-30", actorId: "user-1" }) }),
    }));
  });

  it("recusa item inativo ou de outra empresa sem chamar o Asaas", async () => {
    const { service, prisma, request } = setupPayment();
    prisma.catalogItem.findFirst.mockResolvedValueOnce(null);

    await expect(service.createSubscription("tenant-id", { customerId: "cus_test", catalogItemId: catalogId, value: 10 })).rejects.toThrow("indisponível");
    expect(request).not.toHaveBeenCalled();
  });

  it("exclui assinatura no Asaas e registra auditoria", async () => {
    const { service, prisma, request } = setupPayment();

    const result = await service.removeSubscription("tenant-id", "sub_test", "user-1");

    expect(request).toHaveBeenCalledWith("tenant-id", "/subscriptions/sub_test", { method: "DELETE" });
    expect(result).toEqual({ deleted: true, subscriptionId: "sub_test", environment: "PRODUCTION" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "payment.subscription_deleted", entityId: "sub_test", details: expect.objectContaining({ actorId: "user-1" }) }),
    }));
  });

  it("exclui cliente no Asaas e marca contatos locais como excluídos", async () => {
    const { service, prisma, request } = setupPayment();
    prisma.contact.findMany.mockResolvedValueOnce([{ id: "contact-1", metadata: { asaas: { customerId: "cus_test" } } }]);
    prisma.contact.findFirst.mockResolvedValue({ metadata: { asaas: { customerId: "cus_test" }, contactType: "CUSTOMER" } });

    const result = await service.removeCustomer("tenant-id", "cus_test", "user-1");

    expect(request).toHaveBeenCalledWith("tenant-id", "/customers/cus_test", { method: "DELETE" });
    expect(prisma.contact.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "contact-1" },
      data: { metadata: expect.objectContaining({ asaas: expect.objectContaining({ status: "DELETED" }), asaasSync: expect.objectContaining({ status: "DELETED" }) }) },
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "payment.customer_deleted", details: expect.objectContaining({ affectedContactIds: ["contact-1"], actorId: "user-1" }) }),
    }));
    expect(result).toEqual({ deleted: true, customerId: "cus_test", environment: "PRODUCTION", affectedContacts: 1 });
  });
});

describe("AsaasService catálogo para assinaturas", () => {
  it("lista todos os itens ativos, qualquer que seja a categoria", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: "curso", name: "Curso", priceCents: 9900, description: "", imageUrl: null, createdAt: new Date("2026-01-01T00:00:00Z"), category: "PRODUCT" },
    ]);
    const prisma: any = { catalogItem: { findMany } };
    const service = new AsaasService(prisma as PrismaService);

    const result = await service.listServices("tenant-a");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-a", active: true },
    }));
    expect(result.services).toEqual([expect.objectContaining({ id: "curso", value: 99 })]);
  });
});
