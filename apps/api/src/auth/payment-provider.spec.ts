import { allowedModulesOf, paymentProviderOf, preservePaymentProvider, resolveEntitlements, withPaymentProvider } from "./entitlements";

describe("plataforma de pagamento por empresa", () => {
  it("usa Asaas como padrão recomendado quando nada foi escolhido", () => {
    expect(paymentProviderOf(null)).toBe("ASAAS");
    expect(paymentProviderOf({ paymentProvider: "asaas" })).toBe("ASAAS");
    expect(paymentProviderOf({ paymentProvider: "infinitepay" })).toBe("INFINITEPAY");
  });

  it("mantém SCHOOL fora da Véxora e dos snapshots padrão", () => {
    expect(allowedModulesOf("PLATFORM", null)).not.toContain("SCHOOL");
    expect(resolveEntitlements(null).modules).not.toContain("SCHOOL");
    expect(resolveEntitlements({ modules: ["INBOX", "SCHOOL"] }).modules).toContain("SCHOOL");
  });

  it("altera somente a plataforma escolhida e preserva os demais entitlements", () => {
    const next = withPaymentProvider({ modules: ["INBOX"], finance: true }, "STRIPE");
    expect(next).toEqual({ modules: ["INBOX"], finance: true, paymentProvider: "STRIPE" });
    expect(() => withPaymentProvider({}, "BOLETO")).toThrow();
  });

  it("mantém a escolha da Véxora quando um plano é reatribuído", () => {
    const previous = { modules: ["INBOX"], paymentProvider: "STRIPE" };
    const planSnapshot = { modules: ["CRM"], paymentProvider: "ASAAS" };
    expect(preservePaymentProvider(previous, planSnapshot)).toEqual({ modules: ["CRM"], paymentProvider: "STRIPE" });
    expect(preservePaymentProvider(previous, { modules: ["CRM"] })).toEqual({ modules: ["CRM"], paymentProvider: "STRIPE" });
  });
});
