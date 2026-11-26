import { CatalogImageController } from "./catalog-image.controller";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
const request: any = { user: { tenantId: "tenant-a", role: "ADMIN", sub: "user-1" } };

function setup() {
  const prisma: any = {
    siteAsset: {
      findMany: jest.fn().mockResolvedValue([
        { id: "asset-1", name: "capa", mimeType: "image/webp", width: 1200, height: 800, createdAt: new Date("2026-01-01T00:00:00Z") },
      ]),
      create: jest.fn().mockResolvedValue({ id: "asset-2" }),
      findFirst: jest.fn().mockResolvedValue({ mimeType: "image/webp", bytes: new Uint8Array(PNG) }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const drive: any = { download: jest.fn().mockResolvedValue({ name: "capa.png", type: "image/png", buffer: PNG }) };
  return { controller: new CatalogImageController(prisma, drive), prisma, drive };
}

describe("imagens do catálogo", () => {
  it("lista somente imagens da empresa com URL servida pela própria Véxora", async () => {
    const { controller, prisma } = setup();
    const result = await controller.list(request);
    expect(prisma.siteAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-a", kind: "image" },
    }));
    expect(result.assets).toEqual([expect.objectContaining({ id: "asset-1", url: "/api/backend/catalog-images/asset-1/content" })]);
  });

  it("grava o upload no tenant e devolve a URL interna", async () => {
    const { controller, prisma } = setup();
    const result = await controller.upload(request, { buffer: PNG, size: PNG.length, mimetype: "image/png", originalname: "capa.png" });
    const data = prisma.siteAsset.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenantId: "tenant-a", kind: "image", folder: "/catalogo", mimeType: "image/webp" });
    expect(data.bytes.length).toBeGreaterThan(0);
    expect(result).toEqual({ url: "/api/backend/catalog-images/asset-2/content" });
  });

  it("recusa arquivo que não é imagem", async () => {
    const { controller, prisma } = setup();
    await expect(controller.upload(request, { buffer: PNG, size: PNG.length, mimetype: "text/html", originalname: "capa.html" })).rejects.toThrow("Escolha uma imagem");
    expect(prisma.siteAsset.create).not.toHaveBeenCalled();
  });

  it("não serve imagem de outra empresa", async () => {
    const { controller, prisma } = setup();
    prisma.siteAsset.findFirst.mockResolvedValueOnce(null);
    const res: any = { setHeader: jest.fn(), send: jest.fn() };
    await expect(controller.content(request, "asset-1", res)).rejects.toThrow("Imagem não encontrada.");
    expect(res.send).not.toHaveBeenCalled();
  });

  it("copia imagem do Drive para o tenant em vez de guardar uma URL dependente da sessão", async () => {
    const { controller, prisma, drive } = setup();
    const result = await controller.fromDrive(request, { accountId: "11111111-1111-4111-8111-111111111111", fileId: "arquivo-1" });
    expect(drive.download).toHaveBeenCalledWith(request, "11111111-1111-4111-8111-111111111111", "arquivo-1");
    expect(prisma.siteAsset.create.mock.calls[0][0].data).toMatchObject({ tenantId: "tenant-a", kind: "image" });
    expect(result).toEqual({ url: "/api/backend/catalog-images/asset-2/content" });
  });

  it("exige administrador para importar do Drive", async () => {
    const { controller, drive } = setup();
    const manager: any = { user: { tenantId: "tenant-a", role: "MANAGER", sub: "user-2" } };
    await expect(controller.fromDrive(manager, { accountId: "11111111-1111-4111-8111-111111111111", fileId: "arquivo-1" })).rejects.toThrow("Somente administradores");
    expect(drive.download).not.toHaveBeenCalled();
  });
});
