import { DocumentsController } from "./documents.controller";

const tenantId = "tenant-quote-1";
const request: any = { user: { tenantId, role: "ADMIN", sub: "user-1" } };

const template: any = {
  id: "template-quote-1",
  tenantId,
  kind: "QUOTE",
  name: "Orçamento",
  variables: [
    { key: "nome_cliente", label: "Nome do cliente", required: true },
    { key: "objetivo", label: "Objetivo", required: true },
    { key: "escopo", label: "Escopo", required: true },
    { key: "valor", label: "Valor", required: true },
    { key: "prazo", label: "Prazo", required: true },
    { key: "forma_pagamento", label: "Pagamento", required: true },
  ],
  body: "Proposta para {{nome_cliente}}\n{{objetivo}}\n{{escopo}}\nPrazo: {{prazo}}\nValor: {{valor}}\nPagamento: {{forma_pagamento}}",
  tenant: { name: "Tenente" },
};

const catalogRow = {
  id: "item-1",
  kind: "SERVICE",
  name: "Site institucional",
  description: "Página institucional responsiva",
  sku: "SITE-01",
  priceCents: 120000,
  currency: "BRL",
  unit: "un",
  category: "Web",
};

function setup(items: any[] = [catalogRow]) {
  const prisma: any = {
    documentTemplate: { findFirst: jest.fn().mockResolvedValue(template) },
    catalogItem: { findMany: jest.fn().mockResolvedValue(items) },
    contact: { findFirst: jest.fn().mockResolvedValue(null) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ name: "Tenente", integrations: {} }) },
    generatedDocument: { create: jest.fn().mockImplementation(async (args: any) => ({ id: "doc-1", ...args.data, createdAt: new Date() })) },
  };
  const controller = new DocumentsController(prisma, {} as any, {} as any, {} as any);
  return { controller, prisma };
}

describe("catálogo no orçamento", () => {
  it("usa o primeiro modelo QUOTE do tenant quando templateId não é enviado", async () => {
    const { controller, prisma } = setup();
    const out: any = await controller.generate(request, {
      values: { nome_cliente: "Ana" },
      catalogItems: [{ id: "item-1", quantity: 1 }],
    });
    expect(prisma.documentTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId, kind: "QUOTE" }, orderBy: { createdAt: "asc" } }),
    );
    expect(out.document.kind).toBe("QUOTE");
  });

  it("recalcula escopo e valor no servidor e ignora condições enviadas pelo cliente", async () => {
    const { controller, prisma } = setup();
    const out: any = await controller.generate(request, {
      values: {
        nome_cliente: "Ana",
        valor: "R$ 0,01",
        prazo: "7 dias",
        forma_pagamento: "À vista ou em até 3x",
      },
      catalogItems: [{ id: "item-1", quantity: 2 }],
    });
    expect(out.document.values.valor).toBe("R$ 2.400,00");
    expect(out.document.values.prazo).toBe("A definir com o cliente");
    expect(out.document.values.forma_pagamento).toBe("A definir com o cliente");
    expect(out.document.content).toContain("2x Site institucional");
    expect(out.document.values.catalogItems[0]).toMatchObject({
      id: "item-1",
      quantity: 2,
      unitPriceCents: 120000,
      lineTotalCents: 240000,
    });
    const saved = prisma.generatedDocument.create.mock.calls[0][0].data;
    expect(saved.values.catalogItems[0].lineTotalCents).toBe(240000);
  });

  it("falha claramente quando o item não está disponível neste tenant", async () => {
    const { controller } = setup([]);
    await expect(
      controller.generate(request, { values: { nome_cliente: "Ana" }, catalogItems: [{ id: "item-1", quantity: 1 }] }),
    ).rejects.toThrow("não está disponível");
  });
});
