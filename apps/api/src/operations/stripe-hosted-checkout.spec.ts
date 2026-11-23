import type { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";

const paymentId = "9dea8c48-142e-4923-a174-d09c0cc47ea2";
const url = "https://checkout.stripe.com/c/pay/test";
const sessionId = "cs_live_test";

function setup() {
  const payment = {
    findFirst: jest.fn().mockResolvedValue({ id: paymentId, amount: 25, externalId: null, invoiceUrl: null, environment: "SANDBOX" }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = { payment, auditLog: { create: jest.fn() } };
  const stripe = new StripeService(prisma as unknown as PrismaService);
  const providers = stripe as unknown as {
    credentials: (tenantId: string) => Promise<{ key: string; environment: "TEST" | "LIVE" }>;
    request: (...args: unknown[]) => Promise<unknown>;
  };
  const credentials = jest.spyOn(providers, "credentials").mockResolvedValue({ key: "placeholder", environment: "LIVE" });
  const provider = jest.spyOn(providers, "request").mockResolvedValue({ id: sessionId, url, livemode: true });
  return { stripe, payment, credentials, provider };
}

describe("Stripe hosted checkout", () => {
  it("creates a hosted link from the stored amount with a stable idempotency key", async () => {
    const { stripe, payment, provider } = setup();
    await expect(stripe.createHostedCheckout("tenant", { paymentId }, "LIVE")).resolves.toEqual({ paymentId, url, environment: "LIVE" });
    expect(provider).toHaveBeenCalledWith("tenant", "/checkout/sessions", expect.any(URLSearchParams), "POST", "vexora-hosted-" + paymentId);
    const body = provider.mock.calls[0]?.[2] as URLSearchParams;
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("2500");
    expect(payment.updateMany).toHaveBeenCalledWith({
      where: { id: paymentId, tenantId: "tenant", status: "PENDING", externalId: null },
      data: { externalId: sessionId, invoiceUrl: url, environment: "PRODUCTION" },
    });
  });

  it("returns a persisted live link without calling Stripe again", async () => {
    const { stripe, payment, provider } = setup();
    payment.findFirst.mockResolvedValue({ id: paymentId, amount: 25, externalId: sessionId, invoiceUrl: url, environment: "PRODUCTION" });
    await expect(stripe.createHostedCheckout("tenant", { paymentId }, "LIVE")).resolves.toMatchObject({ url });
    expect(provider).not.toHaveBeenCalled();
  });

  it("blocks test accounts before calling the provider for the chatbot", async () => {
    const { stripe, credentials, provider } = setup();
    credentials.mockResolvedValue({ key: "placeholder", environment: "TEST" });
    await expect(stripe.createHostedCheckout("tenant", { paymentId }, "LIVE")).rejects.toThrow("produção");
    expect(provider).not.toHaveBeenCalled();
  });

  it("ignores unconfirmed Checkout completion events", async () => {
    const { stripe, payment } = setup();
    await expect(stripe.settleWebhook("tenant", {
      id: "evt_test", type: "checkout.session.completed",
      data: { object: { id: sessionId, payment_status: "unpaid", amount_total: 2500, currency: "brl", livemode: true } },
    })).resolves.toBeNull();
    expect(payment.findFirst).not.toHaveBeenCalled();
  });
});
