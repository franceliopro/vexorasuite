import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { SiteFormsService, allowedFields, cleanValues, findFormBlock, formUuid } from "./site-forms.service";

const SITE = "11111111-1111-4111-8111-111111111111";
const TENANT = "22222222-2222-4222-8222-222222222222";

const documentWithForm = {
  root: {
    id: "root",
    type: "section",
    props: {},
    styles: {},
    children: [
      {
        id: "form_contato",
        type: "form",
        props: { fields: ["Nome", "Email", "Mensagem"] },
        styles: {},
        children: [],
      },
    ],
  },
};

function setup(overrides: Record<string, any> = {}) {
  const prisma: any = {
    site: {
      findUnique: jest.fn().mockResolvedValue({ id: SITE, tenantId: TENANT, name: "Site", published: true }),
      findFirst: jest.fn().mockResolvedValue({ id: SITE }),
    },
    siteDocument: { findUnique: jest.fn().mockResolvedValue({ document: documentWithForm }) },
    siteForm: { upsert: jest.fn().mockResolvedValue({ id: formUuid(`${SITE}:form_contato`) }) },
    siteFormSubmission: {
      create: jest.fn().mockResolvedValue({ id: "99999999-9999-4999-8999-999999999999" }),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        { id: "sub-1", createdAt: new Date(), values: { nome: "Ana" }, form: { name: "form:form_contato" } },
      ]),
    },
    contact: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
    ...overrides,
  };
  return { service: new SiteFormsService(prisma), prisma };
}

describe("formulários de sites publicados", () => {
  it("deriva um UUID estável de site + bloco", () => {
    const first = formUuid(`${SITE}:form_contato`);
    expect(first).toBe(formUuid(`${SITE}:form_contato`));
    expect(first).not.toBe(formUuid(`${SITE}:outro_bloco`));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("localiza o bloco e normaliza os campos aceitos", () => {
    const block = findFormBlock(documentWithForm.root, "form_contato");
    expect(block).toBeTruthy();
    expect(findFormBlock(documentWithForm.root, "inexistente")).toBeNull();
    expect(allowedFields(block!)).toEqual(["nome", "email", "mensagem"]);
  });

  it("aceita apenas campos declarados e valida e-mail", () => {
    const values = cleanValues(
      { nome: " Ana ", email: "ana@example.com", mensagem: "Olá", segredo: "ignorado" },
      ["nome", "email", "mensagem"],
    );
    expect(values).toEqual({ nome: "Ana", email: "ana@example.com", mensagem: "Olá" });
    expect(() => cleanValues({ email: "invalido", nome: "Ana" }, ["nome", "email"])).toThrow(BadRequestException);
    expect(() => cleanValues({ e_mail: "invalido", nome: "Ana" }, ["nome", "e_mail"])).toThrow(BadRequestException);
    expect(() => cleanValues({ segredo: "x" }, ["nome"])).toThrow(BadRequestException);
    expect(() => cleanValues([], ["nome"])).toThrow(BadRequestException);
  });

  it("persiste submissão, contato e auditoria em uma transação", async () => {
    const { service, prisma } = setup();
    const result = await service.submit(
      SITE,
      "form_contato",
      {
        values: { nome: "Ana", email: "ana@example.com", mensagem: "Olá" },
        startedAt: Date.now() - 5_000,
      },
      "198.51.100.10",
    );

    expect(result.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.siteFormSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ siteId: SITE, values: expect.objectContaining({ nome: "Ana" }) }),
      }),
    );
    expect(prisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT, name: "Ana", email: "ana@example.com" }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "site.form.submitted" }) }),
    );
  });

  it("não aceita site não publicado nem bloco ausente", async () => {
    const unpublished = setup();
    unpublished.prisma.site.findUnique.mockResolvedValue({ id: SITE, tenantId: TENANT, name: "Site", published: false });
    await expect(unpublished.service.submit(SITE, "form_contato", {}, "1.2.3.4")).rejects.toBeInstanceOf(NotFoundException);

    const missing = setup();
    missing.prisma.siteDocument.findUnique.mockResolvedValue({ document: { root: { type: "section", children: [] } } });
    await expect(missing.service.submit(SITE, "form_contato", {}, "1.2.3.5")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("honeypot responde sucesso sem gravar", async () => {
    const { service, prisma } = setup();
    const result = await service.submit(SITE, "form_contato", { website: "spam.com" }, "198.51.100.11");
    expect(result.ok).toBe(true);
    expect(prisma.siteFormSubmission.create).not.toHaveBeenCalled();
  });

  it("bloqueia envio rápido demais e excesso de requisições", async () => {
    const { service } = setup();
    await expect(
      service.submit(SITE, "form_contato", { values: { nome: "Ana" }, startedAt: Date.now() }, "198.51.100.12"),
    ).rejects.toBeInstanceOf(HttpException);

    const other = "33333333-3333-4333-8333-333333333333";
    const limited = setup();
    limited.prisma.site.findUnique.mockResolvedValue({ id: other, tenantId: TENANT, name: "Site", published: true });
    limited.prisma.siteDocument.findUnique.mockResolvedValue({
      document: { root: { id: "root", type: "section", children: [{ id: "form_contato", type: "form", props: { fields: ["nome"] }, children: [] }] } },
    });
    for (let index = 0; index < 8; index += 1) {
      await limited.service.submit(other, "form_contato", { values: { nome: "Ana" } }, "198.51.100.13");
    }
    await expect(
      limited.service.submit(other, "form_contato", { values: { nome: "Ana" } }, "198.51.100.13"),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("lista respostas apenas do site da empresa", async () => {
    const { service, prisma } = setup();
    const result = await service.list(SITE, TENANT, 500);
    expect(result.total).toBe(1);
    expect(result.submissions[0]).toMatchObject({ id: "sub-1", formName: "form:form_contato" });
    expect(prisma.siteFormSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));

    prisma.site.findFirst.mockResolvedValue(null);
    await expect(service.list(SITE, "outro-tenant", 50)).rejects.toBeInstanceOf(NotFoundException);
  });
});
