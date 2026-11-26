import { StripeService } from "./stripe.service";

describe("StripeService — leitura financeira e estorno", () => {
  function setup() {
    const prisma: any = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const service = new StripeService(prisma);
    (service as any).credentials = jest.fn().mockResolvedValue({ key: "sk_test", environment: "TEST" });
    const request = jest.fn();
    (service as any).request = request;
    return { service, prisma, request };
  }

  it("normaliza PaymentIntents sem inventar status ou valores", async () => {
    const { service, request } = setup();
    request.mockResolvedValueOnce({
      data: [
        { id: "pi_1", amount: 12550, currency: "brl", status: "succeeded", created: 1800000000, customer: "cus_1", metadata: { invoiceUrl: "https://invoice.test/1" } },
        { id: "pi_2", amount: 900, currency: "brl", status: "canceled", created: 1800000500 },
      ],
      has_more: true,
    });
    const result = await service.listFinanceCharges("tenant-a", 2, new Date("2026-01-01T00:00:00.000Z"));
    expect(result).toMatchObject({ source: "PROVIDER_LIVE", provider: "STRIPE", environment: "TEST", hasMore: true });
    expect(result.items[0]).toMatchObject({ id: "pi_1", amount: 125.5, currency: "BRL", status: "PAID", rawStatus: "succeeded", invoiceUrl: "https://invoice.test/1" });
    expect(result.items[1]).toMatchObject({ id: "pi_2", status: "CANCELLED", rawStatus: "canceled" });
    expect(request.mock.calls[0]![1]).toMatch(/^\/payment_intents\?/);
    expect(request.mock.calls[0]![1]).toContain("created%5Bgte%5D");
  });

  it("junta Products e Prices sem expor dados de outro tenant", async () => {
    const { service, request } = setup();
    request.mockResolvedValueOnce({ data: [{ id: "prod_1", name: "Consultoria", active: true, images: ["https://img.test/1.png"] }], has_more: false });
    request.mockResolvedValueOnce({ data: [{ id: "price_1", product: "prod_1", unit_amount: 9900, currency: "brl", active: true }] });
    const result = await service.listFinanceCatalog("tenant-a", 10);
    expect(result.items).toEqual([{ id: "prod_1", name: "Consultoria", description: null, category: "STRIPE", priceCents: 9900, currency: "BRL", imageUrl: "https://img.test/1.png", active: true }]);
    expect(request.mock.calls[0]![1]).toMatch(/^\/products\?/);
    expect(request.mock.calls[1]![1]).toMatch(/^\/prices\?/);
  });

  it("só marca estorno como executado após resposta da Stripe e audita o ator", async () => {
    const { service, prisma, request } = setup();
    request.mockResolvedValueOnce({ id: "re_1", status: "succeeded", amount: 12550 });
    const result = await service.refundFinanceCharge("tenant-a", "pi_1", "user-1");
    expect(result).toMatchObject({ executed: true, refundId: "re_1", status: "succeeded", amountCents: 12550, environment: "TEST" });
    expect(request.mock.calls[0]!.slice(1, 4)).toEqual(["/refunds", expect.any(URLSearchParams), "POST"]);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: "tenant-a", action: "finance.refund_executed", entityId: "pi_1" }),
    }));
  });
});
