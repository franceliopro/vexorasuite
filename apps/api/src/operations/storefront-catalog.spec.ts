import { StorefrontController, PublicStorefrontController } from "./storefront.controller";
import { StorefrontCatalogService } from "./storefront-catalog.service";

const VALID_TOKEN = "vx_store_" + "a".repeat(43);
const ITEM_ID = "12345678-1234-4234-8234-123456789abc";
const SITE_URL = "https://catalogo.example.com";

describe("StorefrontCatalogService", () => {
  function setup() {
    const storefrontToken: any = {
      findMany: jest.fn().mockResolvedValue([{
        id: "token-1", name: "Site", siteUrl: SITE_URL, lastUsedAt: null, revokedAt: null,
        createdAt: new Date("2026-11-26T00:00:00Z"),
      }]),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: "token-1", name: data.name, siteUrl: data.siteUrl, createdAt: new Date("2026-11-26T00:00:00Z"),
      })),
      findFirst: jest.fn().mockResolvedValue({ id: "token-1", tenantId: "tenant-a", siteUrl: SITE_URL }),
      update: jest.fn().mockImplementation(async ({ data }) => ({ id: "token-1", ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const catalogItem: any = {
      findMany: jest.fn().mockResolvedValue([{
        id: ITEM_ID,
        kind: "SERVICE",
        name: "Consultoria",
        sku: "CONS-01",
        priceCents: 19900,
        currency: "BRL",
        unit: "un",
        category: "ASAAS",
        publicDescription: "Descrição pública aprovada",
        publicImageUrl: "https://cdn.example.com/publico.png",
        publicLink: "https://catalogo.example.com/contato/",
        updatedAt: new Date("2026-11-26T00:00:00Z"),
        description: "Descrição privada",
        imageUrl: "https://interno.example.com/privado.png",
      }]),
      findFirst: jest.fn().mockResolvedValue({ id: ITEM_ID, name: "Consultoria" }),
    };
    return {
      service: new StorefrontCatalogService({ storefrontToken, catalogItem } as any),
      storefrontToken,
      catalogItem,
    };
  }

  it("cria token com prefixo próprio, URL HTTPS e sem devolver o hash", async () => {
    const { service, storefrontToken } = setup();
    const created = await service.createToken("tenant-a", { name: "  Vitrine  ", siteUrl: SITE_URL + "/" });
    expect(created.token).toMatch(/^vx_store_[A-Za-z0-9_-]{43}$/);
    expect(created).toMatchObject({ name: "Vitrine", siteUrl: SITE_URL });
    expect(JSON.stringify(created)).not.toMatch(/tokenHash|hash/i);
    expect(created.warning).toMatch(/não será exibido/);
    expect(storefrontToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: "tenant-a", siteUrl: SITE_URL }),
    }));
  });

  it("recusa URL da vitrine que não seja HTTPS", async () => {
    const { service, storefrontToken } = setup();
    await expect(service.createToken("tenant-a", { name: "Vitrine", siteUrl: "http://catalogo.example.com" }))
      .rejects.toThrow("URL da vitrine inválida");
    expect(storefrontToken.create).not.toHaveBeenCalled();
  });

  it("atualiza nome e URL apenas no tenant do token", async () => {
    const { service, storefrontToken } = setup();
    await expect(service.updateToken("tenant-a", "token-1", { name: "Site novo", siteUrl: "https://novo.example.com" }))
      .resolves.toMatchObject({ siteUrl: "https://novo.example.com" });
    expect(storefrontToken.findFirst).toHaveBeenCalledWith({
      where: { id: "token-1", tenantId: "tenant-a", revokedAt: null },
      select: { id: true },
    });
    storefrontToken.findFirst.mockResolvedValueOnce(null);
    await expect(service.updateToken("tenant-b", "token-1", {})).rejects.toThrow("Vitrine não encontrada");
  });

  it("publica só os campos aprovados do catálogo ativo do tenant do token", async () => {
    const { service, storefrontToken, catalogItem } = setup();
    const result = await service.publicCatalog(VALID_TOKEN);
    expect(storefrontToken.findFirst).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), revokedAt: null, tenant: { status: "ACTIVE" } },
      select: { id: true, tenantId: true },
    });
    expect(catalogItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-a", active: true },
      take: 200,
      select: expect.objectContaining({ publicDescription: true, publicImageUrl: true, publicLink: true }),
    }));
    expect(result.source).toBe("VEXORA_CATALOG");
    expect(result.count).toBe(1);
    expect(result.items[0]).toEqual({
      id: ITEM_ID,
      kind: "SERVICE",
      name: "Consultoria",
      sku: "CONS-01",
      priceCents: 19900,
      currency: "BRL",
      unit: "un",
      category: "ASAAS",
      publicDescription: "Descrição pública aprovada",
      publicImageUrl: "https://cdn.example.com/publico.png",
      publicLink: "https://catalogo.example.com/contato/",
      updatedAt: "2026-11-26T00:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toMatch(/"description"|"imageUrl"|"Descrição privada"|"privado\.png"/i);
    expect(result.notice).toMatch(/não confirma pagamento/);
    expect(storefrontToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("descarta link público inseguro mesmo se gravado no banco", async () => {
    const { service, catalogItem } = setup();
    catalogItem.findMany.mockResolvedValueOnce([{
      id: ITEM_ID, kind: "SERVICE", name: "Consultoria", sku: null, priceCents: 100, currency: "BRL",
      unit: "un", category: "ASAAS", publicDescription: null,
      publicImageUrl: "javascript:alert(1)", publicLink: "http://inseguro.example.com",
      updatedAt: new Date("2026-11-26T00:00:00Z"),
    }]);
    const result = await service.publicCatalog(VALID_TOKEN);
    expect(result.items[0]!.publicImageUrl).toBeNull();
    expect(result.items[0]!.publicLink).toBeNull();
  });

  it("recusa token inválido antes de consultar o catálogo", async () => {
    const { service, storefrontToken, catalogItem } = setup();
    await expect(service.publicCatalog("qualquer-coisa")).rejects.toThrow("Token da vitrine inválido.");
    expect(storefrontToken.findFirst).not.toHaveBeenCalled();
    expect(catalogItem.findMany).not.toHaveBeenCalled();
  });

  it("gera link de 1 item e de catálogo completo a partir da URL configurada", async () => {
    const { service, catalogItem, storefrontToken } = setup();
    const one = await service.share("tenant-a", ITEM_ID);
    expect(catalogItem.findFirst).toHaveBeenCalledWith({
      where: { id: ITEM_ID, tenantId: "tenant-a", active: true },
      select: { id: true, name: true },
    });
    expect(storefrontToken.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a", revokedAt: null, siteUrl: { not: null } },
      select: { siteUrl: true },
      orderBy: { createdAt: "desc" },
    });
    expect(one).toMatchObject({
      configured: true,
      status: "CONFIGURED",
      itemId: ITEM_ID,
      itemName: "Consultoria",
      listUrl: `${SITE_URL}/servicos/`,
      itemUrl: `${SITE_URL}/servicos/${ITEM_ID}/`,
    });
    expect(one.text).toContain(`${SITE_URL}/servicos/${ITEM_ID}/`);
    expect(one.text).toContain("não confirma pagamento");

    const all = await service.share("tenant-a");
    expect(all.itemId).toBeNull();
    expect(all.itemUrl).toBeNull();
    expect(all.listUrl).toBe(`${SITE_URL}/servicos/`);
    expect(all.text).toContain("catálogo completo");
  });

  it("não inventa link quando a vitrine não está configurada", async () => {
    const { service, storefrontToken } = setup();
    storefrontToken.findFirst.mockResolvedValueOnce(null);
    const shared = await service.share("tenant-a");
    expect(shared).toMatchObject({ configured: false, status: "UNCONFIGURED", reason: "SITE_URL_MISSING", listUrl: null, itemUrl: null });
    expect(shared.text).toMatch(/Configure o site do Catálogo/);
    expect(shared.text).not.toMatch(/https?:\/\//);
  });

  it("recusa item de outro tenant ou inexistente ao compartilhar", async () => {
    const { service, catalogItem } = setup();
    catalogItem.findFirst.mockResolvedValueOnce(null);
    await expect(service.share("tenant-b", ITEM_ID)).rejects.toThrow("Item do catálogo não encontrado");
    await expect(service.share("tenant-a", "item-invalido")).rejects.toThrow("Item do catálogo inválido");
  });

  it("mantém a revogação no tenant que criou o token", async () => {
    const { service, storefrontToken } = setup();
    await expect(service.revokeToken("tenant-a", "token-1")).resolves.toEqual({ revoked: true });
    expect(storefrontToken.updateMany).toHaveBeenCalledWith({
      where: { id: "token-1", tenantId: "tenant-a", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    storefrontToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.revokeToken("tenant-b", "token-1")).rejects.toThrow("Token não encontrado ou já revogado.");
  });

  it("não expõe hash na listagem de tokens", async () => {
    const { service } = setup();
    const tokens = await service.listTokens("tenant-a");
    expect(JSON.stringify(tokens)).not.toMatch(/tokenHash/i);
    expect(tokens[0]!.siteUrl).toBe(SITE_URL);
  });
});

describe("Storefront controllers", () => {
  it("reserva a gestão de tokens para administradores e mantém share disponível para atendentes", async () => {
    const service: any = {
      listTokens: jest.fn().mockResolvedValue([]),
      createToken: jest.fn().mockResolvedValue({}),
      updateToken: jest.fn().mockResolvedValue({}),
      revokeToken: jest.fn().mockResolvedValue({}),
      share: jest.fn().mockResolvedValue({ text: "link" }),
    };
    const controller = new StorefrontController(service);
    const memberReq: any = { user: { role: "USER", tenantId: "tenant-a" } };
    await expect(controller.list(memberReq)).rejects.toThrow("Somente administradores");
    await expect(controller.update(memberReq, "token-1", {})).rejects.toThrow("Somente administradores");
    await expect(controller.share(memberReq, ITEM_ID)).resolves.toEqual({ text: "link" });
    expect(service.share).toHaveBeenCalledWith("tenant-a", ITEM_ID);
    const adminReq: any = { user: { role: "OWNER", tenantId: "tenant-a" } };
    await expect(controller.list(adminReq)).resolves.toEqual({ tokens: [] });
    expect(service.listTokens).toHaveBeenCalledWith("tenant-a");
  });

  it("entrega o feed público sem sessão", async () => {
    const payload = { source: "VEXORA_CATALOG", items: [] };
    const controller = new PublicStorefrontController({ publicCatalog: jest.fn().mockResolvedValue(payload) } as any);
    await expect(controller.feed(VALID_TOKEN)).resolves.toBe(payload);
  });
});
