import { CatalogPublicationService } from "./catalog-publication.service";

const tenantId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";

const descriptor = (provider: "ASAAS" | "STRIPE" | "INFINITEPAY", enabled = true, configured = true) => ({
  provider,
  label: provider === "ASAAS" ? "Asaas" : provider === "STRIPE" ? "Stripe" : "InfinitePay",
  enabled,
  configured,
  environment: provider === "STRIPE" ? "TEST" : "PRODUCTION",
  verification: { status: "NOT_VERIFIED", note: "Configuração não prova conexão." },
});

const item = {
  id: itemId,
  name: "Consultoria",
  description: "Descrição privada",
  sku: "SKU-1",
  priceCents: 19900,
  currency: "BRL",
  publicDescription: "Descrição aprovada",
  active: true,
};

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "mirror-1",
  provider: "ASAAS",
  status: "NOT_PUBLISHED",
  source: "VEXORA_TO_PROVIDER",
  objectType: "PAYMENT_LINK",
  externalId: null,
  externalUrl: null,
  environment: null,
  lastError: null,
  metadata: {},
  publishedAt: null,
  importedAt: null,
  updatedAt: new Date("2026-11-26T12:00:00.000Z"),
  ...overrides,
});

function setup(overrides: Record<string, any> = {}) {
  const prisma: any = {
    catalogItem: {
      findFirst: jest.fn().mockResolvedValue(item),
      create: jest.fn().mockResolvedValue({ id: itemId }),
    },
    catalogPublication: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(row(data))),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(row(data))),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(async (fn: (tx: any) => unknown) => fn(prisma)),
  };
  const financeProviders: any = {
    list: jest.fn().mockResolvedValue([descriptor("ASAAS"), descriptor("STRIPE"), descriptor("INFINITEPAY", false, false)]),
    describe: jest.fn().mockImplementation(async (_tenant: string, provider: string) => descriptor(provider as any)),
  };
  const asaas: any = {
    publishCatalogItem: jest.fn().mockResolvedValue({
      objectType: "PAYMENT_LINK", externalId: "lnk_123", externalUrl: "https://www.asaas.com/c/123", environment: "SANDBOX", active: true,
    }),
    listCatalog: jest.fn().mockResolvedValue({
      source: "ASAAS_LIVE", environment: "SANDBOX", products: [{ id: "prod_1", name: "Curso", description: "Da API", value: 150 }], hasMoreProducts: false,
    }),
  };
  const stripe: any = {
    publishCatalogItem: jest.fn().mockResolvedValue({
      objectType: "PRODUCT", externalId: "prod_stripe", externalUrl: null, environment: "TEST", priceId: "price_1", degraded: null,
    }),
    listFinanceCatalog: jest.fn().mockResolvedValue({
      source: "PROVIDER_LIVE", provider: "STRIPE", environment: "TEST", hasMore: false, limit: 50, items: [],
    }),
  };
  const infinitePay: any = {
    publishCatalogItem: jest.fn().mockResolvedValue({
      objectType: "PAYMENT_LINK", externalId: "vxcat_1", externalUrl: "https://checkout.infinitepay.io/vxcat_1", environment: "PRODUCTION",
    }),
  };
  Object.assign(prisma, overrides.prisma || {});
  Object.assign(financeProviders, overrides.financeProviders || {});
  Object.assign(asaas, overrides.asaas || {});
  Object.assign(stripe, overrides.stripe || {});
  Object.assign(infinitePay, overrides.infinitePay || {});
  const service = new CatalogPublicationService(prisma, financeProviders, asaas, stripe, infinitePay);
  return { service, prisma, financeProviders, asaas, stripe, infinitePay };
}

describe("publicação e importação do catálogo por plataforma", () => {
  it("descreve as três plataformas com capacidade e configuração honestas", async () => {
    const { service } = setup();
    const result = await service.status(tenantId, itemId);
    expect(result.itemId).toBe(itemId);
    expect(result.providers.map((row: any) => row.provider)).toEqual(["ASAAS", "STRIPE", "INFINITEPAY"]);
    const asaasRow = result.providers.find((row: any) => row.provider === "ASAAS")!;
    expect(asaasRow.capability).toBe("PAYMENT_LINK");
    expect(asaasRow.canPublish).toBe(true);
    const stripeRow = result.providers.find((row: any) => row.provider === "STRIPE")!;
    expect(stripeRow.capability).toBe("PRODUCT_AND_PRICE");
    const infiniteRow = result.providers.find((row: any) => row.provider === "INFINITEPAY")!;
    expect(infiniteRow.canPublish).toBe(false);
    expect(infiniteRow.note).toMatch(/não tem API de produtos/i);
  });

  it("exige confirmação explícita antes de chamar a plataforma", async () => {
    const { service, asaas, stripe, infinitePay } = setup();
    await expect(service.publish(tenantId, itemId, "ASAAS", undefined, "actor")).rejects.toThrow(/Confirme explicitamente/);
    expect(asaas.publishCatalogItem).not.toHaveBeenCalled();
    expect(stripe.publishCatalogItem).not.toHaveBeenCalled();
    expect(infinitePay.publishCatalogItem).not.toHaveBeenCalled();
  });

  it("mantém espelhos independentes quando o mesmo item é publicado em dois provedores", async () => {
    const { service, prisma, asaas, stripe } = setup();
    await service.publish(tenantId, itemId, "ASAAS", true, "actor");
    await service.publish(tenantId, itemId, "STRIPE", true, "actor");
    const providers = prisma.catalogPublication.create.mock.calls.map((call: any[]) => call[0].data.provider);
    expect(providers).toEqual(["ASAAS", "STRIPE"]);
    expect(asaas.publishCatalogItem).toHaveBeenCalledTimes(1);
    expect(stripe.publishCatalogItem).toHaveBeenCalledTimes(1);

    prisma.catalogPublication.findMany.mockResolvedValue([
      row({ provider: "ASAAS", status: "PUBLISHED", externalId: "lnk_123", objectType: "PAYMENT_LINK" }),
      row({ id: "mirror-2", provider: "STRIPE", status: "PUBLISHED", externalId: "prod_stripe", objectType: "PRODUCT" }),
    ]);
    const status = await service.status(tenantId, itemId);
    expect(status.providers.filter((entry: any) => entry.status === "PUBLISHED").map((entry: any) => entry.provider)).toEqual(["ASAAS", "STRIPE"]);
    expect(status.providers.find((entry: any) => entry.provider === "ASAAS")?.externalId).toBe("lnk_123");
    expect(status.providers.find((entry: any) => entry.provider === "STRIPE")?.externalId).toBe("prod_stripe");
  });

  it("não duplica uma publicação já confirmada", async () => {
    const { service, prisma, asaas } = setup();
    prisma.catalogPublication.findUnique.mockResolvedValue(row({ status: "PUBLISHED", externalId: "lnk_123" }));
    const result = await service.publish(tenantId, itemId, "ASAAS", true, "actor");
    expect(result.alreadyPublished).toBe(true);
    expect(asaas.publishCatalogItem).not.toHaveBeenCalled();
    expect(prisma.catalogPublication.create).not.toHaveBeenCalled();
  });

  it("publica no Asaas usando somente a descrição aprovada e registra auditoria", async () => {
    const { service, asaas, prisma } = setup();
    const result = await service.publish(tenantId, itemId, "ASAAS", true, "actor");
    expect(asaas.publishCatalogItem).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ id: itemId, publicDescription: "Descrição aprovada", description: "Descrição privada" }),
      `vexora:catalog:${itemId}`,
    );
    expect(result.status).toBe("PUBLISHED");
    expect(prisma.catalogPublication.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PUBLISHED", externalId: "lnk_123" }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ details: expect.objectContaining({ provider: "ASAAS", actorId: "actor" }) }),
    }));
  });

  it("mantém o produto Stripe como PARTIAL quando o preço não é confirmado", async () => {
    const { service, stripe, prisma } = setup({
      stripe: {
        publishCatalogItem: jest.fn().mockResolvedValue({
          objectType: "PRODUCT", externalId: "prod_stripe", externalUrl: null, environment: "TEST", priceId: null, degraded: "Produto criado, preço pendente.",
        }),
      },
    });
    const result = await service.publish(tenantId, itemId, "stripe", true, "actor");
    expect(result.status).toBe("PARTIAL");
    expect(stripe.publishCatalogItem).toHaveBeenCalledWith(tenantId, expect.objectContaining({ id: itemId }), null);
    expect(prisma.catalogPublication.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PARTIAL", externalId: "prod_stripe", publishedAt: null }),
    }));
  });

  it("filtra importações já catalogadas e não inventa recursos na InfinitePay", async () => {
    const { service, prisma } = setup({ prisma: {
      catalogPublication: {
        findMany: jest.fn().mockResolvedValue([{ externalId: "prod_1" }]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(row()),
        update: jest.fn().mockResolvedValue(row()),
      },
    } });
    const asaasPreview = await service.importPreview(tenantId, "ASAAS", "50");
    expect(asaasPreview.candidates[0]).toMatchObject({ externalId: "prod_1", alreadyImported: true });
    const infinitePreview = await service.importPreview(tenantId, "INFINITEPAY", "50");
    expect(infinitePreview.source).toBe("UNSUPPORTED");
    expect(infinitePreview.candidates).toEqual([]);
  });

  it("importa item da plataforma sem preencher campos públicos aprovados", async () => {
    const { service, prisma } = setup();
    const result = await service.importItem(tenantId, "ASAAS", "prod_1", true, "actor");
    expect(result.imported).toBe(true);
    expect(prisma.catalogItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        category: "ASAAS",
        publicDescription: null,
        publicImageUrl: null,
        publicLink: null,
      }),
      select: { id: true },
    });
    expect(prisma.catalogPublication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId, provider: "ASAAS", externalId: "prod_1", status: "IMPORTED" }),
    });
  });
});
