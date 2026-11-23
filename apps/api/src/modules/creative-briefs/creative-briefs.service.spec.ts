import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";

let CreativeBriefsService: typeof import("./creative-briefs.service").CreativeBriefsService;
beforeAll(async () => {
  ({ CreativeBriefsService } = await import("./creative-briefs.service"));
});

const TENANT = "22222222-2222-4222-8222-222222222222";
const OTHER_TENANT = "55555555-5555-4555-8555-555555555555";
const USER = "33333333-3333-4333-8333-333333333333";
const BRIEF = "44444444-4444-4444-8444-444444444444";

const complete = () => ({
  title: "Arte da campanha",
  objective: "Apresentar a nova linha de rastreamento",
  channelFormat: "Instagram, feed 1080x1080",
  identity: "Azul institucional, tipografia Manrope, logotipo oficial",
  approvedSource: "Texto aprovado pelo cliente em 2026-11-20",
  deadline: "2026-12-15",
  approver: "Marina Alves — marketing",
  destination: "Instagram @cliente, publicação pelo próprio cliente",
});

function setup(current: Record<string, unknown> = {}) {
  const store = { id: BRIEF, tenantId: TENANT, ...current };
  const prisma: any = {
    creativeBrief: {
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.tenantId === store.tenantId ? store : null),
      ),
      findMany: jest.fn().mockResolvedValue([store]),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: BRIEF, ...data })),
    },
    creativeBriefEvent: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "e1", ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((fn: (tx: any) => unknown) => fn(prisma)),
  };
  return { service: new CreativeBriefsService(prisma), prisma, store };
}

describe("CreativeBriefsService", () => {
  it("rejeita papel sem permissão de gestão", async () => {
    const { service } = setup();
    await expect(service.create(complete(), TENANT, "AGENT", USER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("exige os seis blocos do briefing e uma data válida", async () => {
    const { service } = setup();
    const fields = ["objective", "channelFormat", "identity", "approvedSource", "deadline", "approver", "destination"] as const;
    for (const field of fields) {
      const partial = complete();
      delete (partial as any)[field];
      await expect(service.create(partial, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(service.create({ ...complete(), deadline: "15/12/2026" }, TENANT, "OWNER", USER))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ ...complete(), deadline: "2026-02-30" }, TENANT, "OWNER", USER))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("registra briefing completo com evento de auditoria no tenant", async () => {
    const { service, prisma } = setup();
    const created = await service.create(complete(), TENANT, "OWNER", USER);
    expect(created).toMatchObject({
      tenantId: TENANT,
      createdBy: USER,
      status: "RECEIVED",
      objective: "Apresentar a nova linha de rastreamento",
    });
    expect(prisma.creativeBriefEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: TENANT,
        actorId: USER,
        action: "BRIEF_RECEIVED",
        details: expect.objectContaining({ delivered: false, approved: false, published: false }),
      }),
    }));
  });

  it("isolates reads by tenant and never exposes another tenant's brief", async () => {
    const { service, prisma, store } = setup();
    await service.get(TENANT, BRIEF);
    expect(prisma.creativeBrief.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: BRIEF, tenantId: TENANT },
    }));
    store.tenantId = OTHER_TENANT;
    await expect(service.get(TENANT, BRIEF)).rejects.toBeInstanceOf(NotFoundException);
    await service.list(TENANT);
    expect(prisma.creativeBrief.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT } }));
  });

  it("não expõe operação de geração, aprovação, publicação ou entrega", async () => {
    const { service } = setup();
    for (const method of ["approve", "publish", "deliver", "generate", "createPiece"]) {
      expect((service as any)[method]).toBeUndefined();
    }
  });
});
