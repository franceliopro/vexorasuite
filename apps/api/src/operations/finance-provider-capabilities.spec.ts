import { FINANCE_PROVIDER_DEFINITIONS } from "./finance-provider-capabilities";
import { PAYMENT_PROVIDERS } from "./payment-providers";

describe("finance provider capabilities", () => {
  it("cobre exatamente os três provedores canônicos", () => {
    expect(Object.keys(FINANCE_PROVIDER_DEFINITIONS).sort()).toEqual([...PAYMENT_PROVIDERS].sort());
  });

  it("não atribui origem PROVIDER_LIVE ao painel local do InfinitePay", () => {
    const infinite = FINANCE_PROVIDER_DEFINITIONS.INFINITEPAY;
    for (const key of ["customers", "catalog", "charges", "reports"] as const) {
      expect(infinite.capabilities[key].source).toBe("LOCAL_RECORDS");
      expect(infinite.capabilities[key].note.length).toBeGreaterThan(10);
    }
    expect(infinite.capabilities.subscriptions).toBe(false);
    expect(infinite.capabilities.refunds).toBe(false);
    expect(infinite.capabilities.sandbox).toBe(false);
    expect(infinite.limitations.join(" ")).toMatch(/não lista vendas, clientes ou produtos/);
    expect(infinite.limitations.join(" ")).toMatch(/Não há sandbox/);
    expect(infinite.caveat).toMatch(/local e parcial/);
  });

  it("mantém Asaas e Stripe como leitura ao vivo, com limites explícitos", () => {
    expect(FINANCE_PROVIDER_DEFINITIONS.ASAAS.capabilities.charges.source).toBe("PROVIDER_LIVE");
    expect(FINANCE_PROVIDER_DEFINITIONS.ASAAS.capabilities.refunds).toBe(false);
    expect(FINANCE_PROVIDER_DEFINITIONS.STRIPE.capabilities.charges.source).toBe("PROVIDER_LIVE");
    expect(FINANCE_PROVIDER_DEFINITIONS.STRIPE.capabilities.refunds).toBe(true);
    expect(FINANCE_PROVIDER_DEFINITIONS.STRIPE.capabilities.pixQrCode).toBe(false);
    for (const provider of PAYMENT_PROVIDERS) {
      expect(FINANCE_PROVIDER_DEFINITIONS[provider].capabilities.whatsappCharge).toBe(false);
    }
  });
});
