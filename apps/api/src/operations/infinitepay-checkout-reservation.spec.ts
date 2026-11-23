import type { PrismaService } from "../prisma/prisma.service";
import { InfinitePayService } from "./infinitepay.service";

const paymentId = "9dea8c48-142e-4923-a174-d09c0cc47ea2";
const url = "https://checkout.infinitepay.io/example";

function setup() {
  const payment = {
    findFirst: jest.fn().mockResolvedValue({ id: paymentId, amount: 25, externalId: null, invoiceUrl: null }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const db = { payment, auditLog: { create: jest.fn() } };
  const service = new InfinitePayService(db as unknown as PrismaService);
  const privateService = service as unknown as { credentials: (tenantId: string) => Promise<{ handle: string; apiKey: string | null }> };
  jest.spyOn(privateService, "credentials").mockResolvedValue({ handle: "test", apiKey: null });
  return { service, payment };
}

describe("InfinitePay checkout reservation", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reserves the local payment and stores the confirmed provider link", async () => {
    const { service, payment } = setup();
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ url })));
    await expect(service.createLink("tenant", { paymentId })).resolves.toMatchObject({ paymentId, url, orderNsu: paymentId });
    expect(payment.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: paymentId, tenantId: "tenant", status: "PENDING", externalId: null },
      data: { externalId: paymentId, environment: "PRODUCTION" },
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.checkout.infinitepay.io/links", expect.objectContaining({
      body: expect.stringContaining(paymentId),
    }));
    expect(payment.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { invoiceUrl: url } }));
  });

  it("does not call InfinitePay when another execution claimed the payment", async () => {
    const { service, payment } = setup();
    const fetchMock = jest.spyOn(globalThis, "fetch");
    payment.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.createLink("tenant", { paymentId })).rejects.toThrow("solicitação de link");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("releases the reservation after a definitive refusal", async () => {
    const { service, payment } = setup();
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));
    await expect(service.createLink("tenant", { paymentId })).rejects.toThrow("contas diferentes");
    expect(payment.updateMany).toHaveBeenLastCalledWith({
      where: { id: paymentId, tenantId: "tenant", status: "PENDING", externalId: paymentId, invoiceUrl: null },
      data: { externalId: null },
    });
  });

  it("preserves the reservation after a transport failure and reuses completed links", async () => {
    const { service, payment } = setup();
    const fetchMock = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    await expect(service.createLink("tenant", { paymentId })).rejects.toThrow("timeout");
    expect(payment.updateMany).toHaveBeenCalledTimes(1);
    payment.findFirst.mockResolvedValue({ id: paymentId, amount: 25, externalId: paymentId, invoiceUrl: url });
    await expect(service.createLink("tenant", { paymentId })).resolves.toMatchObject({ url });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
