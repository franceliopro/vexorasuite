import { FinanceProvidersService } from "./finance-providers.service";

describe("FinanceProvidersService", () => {
  function setup() {
    const asaas: any = { publicSettings: jest.fn().mockResolvedValue({ enabled: true, configured: true, sandbox: false }) };
    const stripe: any = { publicSettings: jest.fn().mockResolvedValue({ enabled: true, configured: true, environment: "TEST" }) };
    const infinitePay: any = { publicSettings: jest.fn().mockResolvedValue({ enabled: true, configured: true }) };
    let integrations: Record<string, any> = {};
    const prisma: any = {
      tenant: { findUnique: jest.fn().mockImplementation(async () => ({ integrations })) },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
        $queryRaw: jest.fn().mockResolvedValue([]),
        tenant: {
          findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ integrations })),
          update: jest.fn().mockImplementation(async ({ data }: any) => {
            integrations = data.integrations;
            return {};
          }),
        },
      })),
    };
    return { service: new FinanceProvidersService(asaas, stripe, infinitePay, prisma), asaas, stripe, infinitePay, prisma };
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

  it("oferece ao catálogo somente provedores habilitados e configurados", async () => {
    const { service, stripe } = setup();
    stripe.publicSettings.mockResolvedValueOnce({ enabled: false, configured: false, environment: "TEST" });
    const result = await service.catalogProvider("tenant-a");
    expect(result.selected).toBe("ASAAS");
    expect(result.options.map((option: any) => option.provider)).toEqual(["ASAAS", "INFINITEPAY"]);
    expect(JSON.stringify(result)).not.toMatch(/apiKey|secret/i);
    expect(result.note).toMatch(/não cria cobrança/);
  });

  it("salva a preferência do catálogo sem tocar em outras integrações e sem afirmar pagamento", async () => {
    const { service } = setup();
    const result = await service.selectCatalogProvider("tenant-a", "InfinitePay");
    expect(result.selected).toBe("INFINITEPAY");
    expect(result.options).toHaveLength(3);
    expect(result.note).toMatch(/não cria cobrança/);
  });

  it("recusa configurar o catálogo com um provedor desligado", async () => {
    const { service, infinitePay } = setup();
    infinitePay.publicSettings.mockResolvedValueOnce({ enabled: false, configured: false });
    await expect(service.selectCatalogProvider("tenant-a", "INFINITEPAY")).rejects.toThrow("não está habilitado");
  });
});
