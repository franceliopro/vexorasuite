import { FinanceProvidersService } from "./finance-providers.service";

describe("FinanceProvidersService", () => {
  function setup() {
    const asaas: any = { publicSettings: jest.fn().mockResolvedValue({ enabled: true, configured: true, sandbox: false }) };
    const stripe: any = { publicSettings: jest.fn().mockResolvedValue({ enabled: true, configured: true, environment: "TEST" }) };
    const infinitePay: any = { publicSettings: jest.fn().mockResolvedValue({ enabled: true, configured: true }) };
    return { service: new FinanceProvidersService(asaas, stripe, infinitePay), asaas, stripe, infinitePay };
  }

  it("descreve os três provedores sem expor segredos", async () => {
    const { service } = setup();
    const rows = await service.list("tenant-a");
    expect(rows.map((row) => row.provider)).toEqual(["ASAAS", "STRIPE", "INFINITEPAY"]);
    expect(rows.map((row) => row.environment)).toEqual(["PRODUCTION", "TEST", "PRODUCTION"]);
    expect(JSON.stringify(rows)).not.toMatch(/apiKey|secretKey|webhookToken|encrypted/i);
  });

  it("canonicaliza aliases e mantém verificação não provada", async () => {
    const { service, stripe } = setup();
    const row = await service.describe("tenant-a", "InfinitePay");
    expect(row.provider).toBe("INFINITEPAY");
    expect(row.verification).toEqual({ status: "NOT_VERIFIED", note: expect.stringMatching(/não prova conexão/) });
    expect(stripe.publicSettings).not.toHaveBeenCalled();
    await expect(service.describe("tenant-a", "mercadopago")).rejects.toThrow("Provedor financeiro inválido.");
  });
});
