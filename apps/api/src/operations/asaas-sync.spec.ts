import { PrismaService } from "../prisma/prisma.service";
import { AsaasService } from "./asaas.service";

describe("AsaasService customer synchronization", () => {
  function setup(existing: unknown[] = []) {
    const tx = {
      contact: {
        findMany: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockResolvedValue({ id: "new-contact" }),
        update: jest.fn().mockResolvedValue({ id: "existing-contact" }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const service = new AsaasService(prisma);
    jest.spyOn(service as any, "credentials").mockResolvedValue({ key: "test", sandbox: true });
    jest.spyOn(service as any, "request").mockResolvedValue({
      data: [{
        id: "cus_123", name: "Cliente Exemplo", cpfCnpj: "12345678901",
        mobilePhone: "11987654321", email: "cliente@example.com",
        address: "Rua A", addressNumber: "10", province: "Centro",
        cityName: "São Paulo", state: "SP", postalCode: "01000-000",
      }],
      hasMore: false,
    });
    return { service, prisma: prisma as any, tx };
  }

  it("imports an Asaas customer with identity and address metadata", async () => {
    const { service, tx } = setup();
    const result = await service.syncCustomers("tenant-id");
    expect(result).toMatchObject({ created: 1, updated: 0, unchanged: 0, pages: 1, total: 1, environment: "SANDBOX" });
    expect(tx.contact.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "tenant-id",
        name: "Cliente Exemplo",
        source: "ASAAS",
        metadata: expect.objectContaining({
          document: "12345678901",
          personType: "PF",
          asaas: expect.objectContaining({ customerId: "cus_123", environment: "SANDBOX" }),
        }),
      }),
    }));
  });

  it("updates an existing Asaas-linked contact instead of creating a duplicate", async () => {
    const existing = {
      id: "existing-contact", name: "Cliente Exemplo", phone: "11987654321",
      email: "cliente@example.com", source: "ASAAS",
      metadata: {
        document: "12345678901", personType: "PF",
        asaas: { customerId: "cus_123", environment: "SANDBOX", syncedAt: "2026-01-01T00:00:00.000Z" },
      },
    };
    const { service, tx } = setup([existing]);
    const result = await service.syncCustomers("tenant-id");
    expect(result).toMatchObject({ created: 0, updated: 1, total: 1 });
    expect(tx.contact.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "existing-contact" },
      data: expect.objectContaining({ name: "Cliente Exemplo", source: "ASAAS" }),
    }));
    expect(tx.contact.create).not.toHaveBeenCalled();
  });
});
