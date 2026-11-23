import { createHmac } from "node:crypto";
import {
  amountToCents,
  canonicalPaymentProvider,
  paymentProviderAliases,
} from "./payment-providers";
import { verifyStripeWebhookSignature } from "./stripe.service";
import { infinitepayPaymentApproved } from "./infinitepay.service";

describe("payment providers", () => {
  test("aliases legados e novos normalizam sem perder registros antigos", () => {
    expect(canonicalPaymentProvider("ASAAS")).toBe("ASAAS");
    expect(canonicalPaymentProvider("asaas")).toBe("ASAAS");
    expect(canonicalPaymentProvider("STRIPE")).toBe("STRIPE");
    expect(canonicalPaymentProvider("stripe")).toBe("STRIPE");
    expect(canonicalPaymentProvider("InfinitePay")).toBe("INFINITEPAY");
    expect(canonicalPaymentProvider("unknown")).toBeNull();
    expect(paymentProviderAliases("STRIPE")).toEqual(expect.arrayContaining(["STRIPE", "stripe"]));
    expect(paymentProviderAliases("ASAAS")).toEqual(expect.arrayContaining(["ASAAS", "asaas"]));
    expect(amountToCents("125.50")).toBe(12550);
  });

  const secret = "whsec_teste";
  const payload = '{"id":"evt_1","type":"payment_intent.succeeded"}';
  function signature(timestamp: number, body = payload, key = secret) {
    return `t=${timestamp},v1=${createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex")}`;
  }

  test("Stripe aceita assinatura v1 sobre o corpo cru", () => {
    const now = 1_800_000_000;
    expect(verifyStripeWebhookSignature(Buffer.from(payload), signature(now), secret, now).id).toBe("evt_1");
  });

  test("Stripe rejeita v0, payload alterado, segredo errado e timestamp antigo", () => {
    const now = 1_800_000_000;
    const v0 = `t=${now},v0=${createHmac("sha256", secret).update(`${now}.${payload}`).digest("hex")}`;
    expect(() => verifyStripeWebhookSignature(Buffer.from(payload), v0, secret, now)).toThrow();
    expect(() => verifyStripeWebhookSignature(Buffer.from(payload), signature(now), "whsec_outro", now)).toThrow();
    expect(() => verifyStripeWebhookSignature(Buffer.from(payload + " "), signature(now), secret, now)).toThrow();
    expect(() => verifyStripeWebhookSignature(Buffer.from(payload), signature(now - 400), secret, now)).toThrow();
  });

  test("InfinitePay só aprova com success, paid e amount original igual ao esperado", () => {
    expect(infinitepayPaymentApproved({ success: true, paid: true, amount: 1500, paid_amount: 1510 }, 1500)).toBe(true);
    expect(infinitepayPaymentApproved({ success: true, paid: true, amount: 1510, paid_amount: 1510 }, 1500)).toBe(false);
    expect(infinitepayPaymentApproved({ success: true, paid: false, amount: 1500 }, 1500)).toBe(false);
    expect(infinitepayPaymentApproved({ success: false, paid: true, amount: 1500 }, 1500)).toBe(false);
  });
});
