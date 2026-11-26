import { InfinitePayFinanceService } from "./infinite-pay-finance.service";

describe("InfinitePayFinanceService — painel local e parcial", () => {
  function setup() {
    const prisma: any = {
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      contact: { findMany: jest.fn().mockResolvedValue([]) },
      catalogItem: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    return { service: new InfinitePayFinanceService(prisma), prisma };
  }

  it("filtra cobranças por tenant e aliases do provedor", async () => {
    const { service, prisma } = setup();
    prisma.payment.findMany.mockResolvedValueOnce([{
      id: "payment-1", externalId: "nsu-1", amount: 150, status: "PAID", environment: "PRODUCTION",
      createdAt: new Date("2026-11-01T12:00:00.000Z"), invoiceUrl: "https://pay.test/1",
      contact: { id: "contact-1", name: "Ana", phone: null, email: "ana@teste.com" },
    }]);
    prisma.payment.count.mockResolvedValueOnce(1);
    const result = await service.listCharges("tenant-a", { offset: 0, limit: 10 });
    expect(result).toMatchObject({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", total: 1 });
    expect(result.items[0]).toMatchObject({ orderNsu: "nsu-1", amount: 150, currency: "BRL", status: "PAID" });
    expect(prisma.payment.findMany.mock.calls[0]![0].where).toEqual({
      tenantId: "tenant-a",
      provider: { in: expect.arrayContaining(["INFINITEPAY", "infinitepay", "InfinitePay"]) },
    });
  });

  it("só conta como pago o status confirmado pelo payment_check", async () => {
    const { service, prisma } = setup();
    prisma.payment.findMany.mockResolvedValueOnce([
      { id: "1", amount: 100, status: "PAID", environment: "PRODUCTION", createdAt: new Date("2026-11-01T10:00:00.000Z"), contactId: "a" },
      { id: "2", amount: 200, status: "PENDING", environment: "PRODUCTION", createdAt: new Date("2026-11-02T10:00:00.000Z"), contactId: "b" },
      { id: "3", amount: 300, status: "CANCELLED", environment: "PRODUCTION", createdAt: new Date("2026-11-03T10:00:00.000Z"), contactId: "c" },
    ]);
    const result = await service.dashboard("tenant-a", {
      from: new Date("2026-11-01T00:00:00.000Z"), until: new Date("2026-11-30T23:59:59.999Z"), months: 1,
    });
    expect(result.totals).toEqual({ billed: 300, paid: 100, open: 200, count: 2, overdueCount: 0 });
    expect(result.outstandingContacts).toBe(1);
    expect(result.caveat).toMatch(/payment_check/);
  });

  it("limita o catálogo ao catálogo local da empresa", async () => {
    const { service, prisma } = setup();
    await service.listCatalog("tenant-a", { offset: 5, limit: 20 });
    expect(prisma.catalogItem.findMany.mock.calls[0]![0].where).toEqual({ tenantId: "tenant-a", category: "INFINITEPAY", active: true });
    expect(prisma.catalogItem.findMany.mock.calls[0]![0].skip).toBe(5);
    expect(prisma.catalogItem.findMany.mock.calls[0]![0].take).toBe(20);
  });
});
