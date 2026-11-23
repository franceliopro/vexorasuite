import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";

const lookup = jest.fn();
jest.unstable_mockModule("node:dns/promises", () => ({ lookup }));

let SiteHubService: typeof import("./site-hub.service").SiteHubService;
beforeAll(async () => {
  ({ SiteHubService } = await import("./site-hub.service"));
});

const TENANT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const REQUEST = "44444444-4444-4444-8444-444444444444";

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST,
    tenantId: TENANT,
    siteId: null,
    slug: "site-cliente",
    name: "Site Cliente",
    kind: "STATIC",
    status: "DRAFT",
    brief: {},
    repository: null,
    targetDomain: "site.example.com",
    previewUrl: null,
    previewSha: null,
    createdBy: USER,
    decidedBy: null,
    decisionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(current: Record<string, unknown> = {}) {
  const store = request(current);
  const prisma: any = {
    siteHubRequest: {
      findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.tenantId === store.tenantId ? store : null)),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...request(), ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...store, ...data })),
      findMany: jest.fn().mockResolvedValue([store]),
    },
    siteHubVersion: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "v1", ...data })),
      aggregate: jest.fn().mockResolvedValue({ _max: { version: 1 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    siteHubApproval: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "a1", ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    siteHubEvent: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "e1", ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((fn: (tx: any) => unknown) => fn(prisma)),
  };
  return { service: new SiteHubService(prisma), prisma, store };
}

describe("SiteHubService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    }) as any;
  });

  it("rejeita papel sem permissão de gestão", async () => {
    const { service } = setup();
    await expect(service.create({ name: "Site", slug: "site" }, TENANT, "AGENT", USER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("valida slug e tipo e registra evento de criação no tenant", async () => {
    const { service, prisma } = setup();
    await expect(service.create({ name: "Site", slug: "Slug Invalido" }, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ name: "Site", slug: "novo-site", kind: "WORDPRESS" }, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);

    const created = await service.create({ name: "Site", slug: "novo-site", brief: { objetivo: "institucional" } }, TENANT, "OWNER", USER);
    expect(created).toMatchObject({ tenantId: TENANT, slug: "novo-site", kind: "STATIC", status: "DRAFT" });
    expect(prisma.siteHubEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "REQUEST_CREATED", tenantId: TENANT, actorId: USER }),
    }));
  });

  it("isolates reads by tenant", async () => {
    const { service, prisma, store } = setup();
    await service.get(TENANT, REQUEST);
    expect(prisma.siteHubRequest.findFirst).toHaveBeenCalledWith({ where: { id: REQUEST, tenantId: TENANT } });
    store.tenantId = "99999999-9999-4999-8999-999999999999";
    await expect(service.get(TENANT, REQUEST)).rejects.toBeInstanceOf(NotFoundException);
    await service.list(TENANT);
    expect(prisma.siteHubRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT } }));
  });

  it("registra preview como versão, nunca como publicação", async () => {
    const { service, prisma } = setup();
    const updated = await service.registerPreview(REQUEST, { previewUrl: "https://preview.example.com", commitSha: "abc123" }, TENANT, "ADMIN", USER);
    expect(updated).toMatchObject({ status: "PREVIEW_READY", previewUrl: "https://preview.example.com" });
    expect(prisma.siteHubVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ version: 1, createdBy: USER }),
    }));
    expect(prisma.siteHubEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "PREVIEW_RECORDED" }),
    }));
    await expect(service.registerPreview(REQUEST, { previewUrl: "http://169.254.169.254/latest/meta-data" }, TENANT, "ADMIN", USER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("exige preview antes da decisão e grava aprovação", async () => {
    const { service } = setup();
    await expect(service.decide(REQUEST, { decision: "APPROVED" }, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);

    const { service: ready, prisma } = setup({ status: "PREVIEW_READY" });
    const decided = await ready.decide(REQUEST, { decision: "APPROVED", note: "Aprovado pelo cliente" }, TENANT, "OWNER", USER);
    expect(decided).toMatchObject({ status: "APPROVED", decidedBy: USER });
    expect(prisma.siteHubApproval.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ decision: "APPROVED", decidedBy: USER }),
    }));
  });

  it("só encaminha pedido aprovado e com domínio", async () => {
    const { service } = setup({ status: "PREVIEW_READY" });
    await expect(service.requestPublish(REQUEST, {}, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);
    const { service: approved } = setup({ status: "APPROVED", targetDomain: null });
    await expect(approved.requestPublish(REQUEST, {}, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);
    const ok = await approved.requestPublish(REQUEST, { targetDomain: "site.example.com" }, TENANT, "OWNER", USER);
    expect(ok).toMatchObject({ status: "PUBLISH_REQUESTED", targetDomain: "site.example.com" });
  });

  it("não confirma publicação sem resposta 2xx nem para domínio interno", async () => {
    const { service, prisma } = setup({ status: "PUBLISH_REQUESTED", targetDomain: "site.example.com" });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ status: 503, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) });
    await expect(service.confirmPublished(REQUEST, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.siteHubRequest.update).not.toHaveBeenCalled();

    lookup.mockResolvedValueOnce([{ address: "127.0.0.1" }]);
    await expect(service.confirmPublished(REQUEST, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const confirmed = await service.confirmPublished(REQUEST, TENANT, "OWNER", USER);
    expect(confirmed).toMatchObject({ status: "PUBLISHED" });
    expect(prisma.siteHubEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "PUBLISHED_CONFIRMED", actorId: USER }),
    }));
  });
});
