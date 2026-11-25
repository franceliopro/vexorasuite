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
    const request: any = { user: { tenantId: "tenant-a", role: "ADMIN" }, query: { includeInactive: "true" } };
    await controller.list(request);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ tenantId: "tenant-a" });
    expect(findMany.mock.calls[0][0].where.active).toBeUndefined();
  });

  it("mantém inativos ocultos para papéis não administrativos", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma: any = { catalogItem: { findMany } };
    const controller = new CatalogController(prisma);
    const request: any = { user: { tenantId: "tenant-a", role: "MANAGER" }, query: { includeInactive: "true" } };
    await controller.list(request);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ tenantId: "tenant-a", active: true });
  });
});
