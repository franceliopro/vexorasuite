import { CatalogController } from "./catalog.controller";

describe("escopo do catálogo", () => {
  it("não desativa itens de outra empresa", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma: any = { catalogItem: { updateMany } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "ADMIN" } };
    await expect(controller.remove(request, "item-de-outra-empresa")).rejects.toThrow("Item não encontrado.");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "item-de-outra-empresa", tenantId: "tenant-a" },
      data: { active: false },
    });
  });

  it("permite que administradores vejam itens inativos do próprio tenant", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma: any = { catalogItem: { findMany } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "ADMIN" } };
    await controller.list(request, undefined, undefined, undefined, undefined, "true");
    expect(findMany.mock.calls[0][0].where).toMatchObject({ tenantId: "tenant-a" });
    expect(findMany.mock.calls[0][0].where.active).toBeUndefined();
  });

  it("mantém inativos ocultos para papéis não administrativos", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma: any = { catalogItem: { findMany } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "MANAGER" } };
    await controller.list(request, undefined, undefined, undefined, undefined, "true");
    expect(findMany.mock.calls[0][0].where).toMatchObject({ tenantId: "tenant-a", active: true });
  });

  it("filtra por categoria sem perder o escopo do tenant e o filtro de ativos", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma: any = { catalogItem: { findMany } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "MANAGER" } };
    await controller.list(request, undefined, undefined, "ASAAS", "50");
    expect(findMany.mock.calls[0][0].where).toMatchObject({ tenantId: "tenant-a", active: true, category: "ASAAS" });
  });

  it("cadastra sem categoria como ASAAS para aparecer no Financeiro", async () => {
    const create = jest.fn().mockResolvedValue({ id: "item-novo" });
    const prisma: any = { catalogItem: { create } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "ADMIN" } };
    await controller.create(request, { name: "Curso de boas-vindas", priceCents: 9900 });
    expect(create.mock.calls[0][0].data).toMatchObject({ tenantId: "tenant-a", category: "ASAAS" });
  });

  it("aceita imagem HTTP(S) e arquivo interno, mas rejeita outros esquemas", async () => {
    const create = jest.fn().mockResolvedValue({ id: "item-novo" });
    const prisma: any = { catalogItem: { create } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "ADMIN" } };
    await controller.create(request, { name: "Curso", priceCents: 100, imageUrl: "https://exemplo.com/curso.png" });
    await controller.create(request, { name: "Curso", priceCents: 100, imageUrl: "/api/backend/drive-manager/conta/arquivo/content" });
    expect(create.mock.calls.map((call) => call[0].data.imageUrl)).toEqual([
      "https://exemplo.com/curso.png",
      "/api/backend/drive-manager/conta/arquivo/content",
    ]);
    await expect(controller.create(request, { name: "Curso", priceCents: 100, imageUrl: "javascript:alert(1)" })).rejects.toThrow("URL de imagem inválida.");
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("normaliza categoria vazia para ASAAS ao editar item legado", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "item-legado" });
    const update = jest.fn().mockResolvedValue({ id: "item-legado" });
    const prisma: any = { catalogItem: { findFirst, update } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "ADMIN" } };
    await controller.update(request, "item-legado", { category: "" });
    expect(update.mock.calls[0][0].data).toMatchObject({ category: "ASAAS" });
  });
});
