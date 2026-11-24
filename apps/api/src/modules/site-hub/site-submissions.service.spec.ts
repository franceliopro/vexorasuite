import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";

let SiteSubmissionsService: typeof import("./site-submissions.service").SiteSubmissionsService;
beforeAll(async () => {
  ({ SiteSubmissionsService } = await import("./site-submissions.service"));
});

const TENANT = "22222222-2222-4222-8222-222222222222";
const OTHER = "99999999-9999-4999-8999-999999999999";
const USER = "33333333-3333-4333-8333-333333333333";
const KEY = "aa-1024-2026";

function submission() {
  return {
    id: "s1",
    submission_key: KEY,
    name: "Ana",
    email: "ana@example.com",
    phone: null,
    payload: { title: "Apartamento", code: "AA-1024" },
    status: "pending",
    rejection_reason: null,
    property_id: null,
    date_created: "2026-11-24T00:00:00.000Z",
    date_updated: null,
  };
}

function decision(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    tenantId: TENANT,
    submissionKey: KEY,
    directusId: "s1",
    decision: "APPROVED",
    reason: "Atende aos critérios",
    actorId: USER,
    status: "DECIDED",
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setup(prior: Record<string, unknown> | null = null, configuredTenant = TENANT) {
  const directus: any = {
    assertConfigured: jest.fn().mockImplementation((tenantId: string) => {
      if (tenantId !== configuredTenant) throw new ServiceUnavailableException("Não configurado para esta empresa.");
    }),
    listPending: jest.fn().mockResolvedValue([submission()]),
    findByKey: jest.fn().mockResolvedValue(submission()),
    decide: jest.fn().mockResolvedValue(undefined),
  };
  const prisma: any = {
    siteHubSubmissionDecision: {
      findUnique: jest.fn().mockResolvedValue(prior),
      findMany: jest.fn().mockResolvedValue(prior ? [prior] : []),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...decision(), ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...decision(), ...data })),
    },
  };
  return { service: new SiteSubmissionsService(prisma, directus), prisma, directus };
}

describe("SiteSubmissionsService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejeita papel sem permissão de gestão", async () => {
    const { service, directus } = setup();
    await expect(service.list(TENANT, "AGENT")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.decide(KEY, { decision: "APPROVED" }, TENANT, "AGENT", USER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(directus.listPending).not.toHaveBeenCalled();
  });

  it("não usa a integração configurada em outra empresa", async () => {
    const { service, directus } = setup();
    await expect(service.list(OTHER, "OWNER")).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(directus.assertConfigured).toHaveBeenCalledWith(OTHER);
    expect(directus.listPending).not.toHaveBeenCalled();
  });

  it("junta a decisão local sem afirmar que a notificação foi enviada", async () => {
    const { service } = setup(decision());
    const result = await service.list(TENANT, "OWNER");
    expect(result.submissions[0]?.decision).toMatchObject({ decision: "APPROVED", actorId: USER });
    expect(result.notification.status).toBe("NOT_CONFIRMED");
  });

  it("exige motivo para rejeitar", async () => {
    const { service, directus } = setup();
    await expect(service.decide(KEY, { decision: "REJECTED" }, TENANT, "OWNER", USER)).rejects.toBeInstanceOf(BadRequestException);
    expect(directus.decide).not.toHaveBeenCalled();
  });

  it("registra a decisão e não confirma o envio", async () => {
    const { service, directus, prisma } = setup();
    const result = await service.decide(KEY, { decision: "APPROVED" }, TENANT, "ADMIN", USER);
    expect(directus.findByKey).toHaveBeenCalledWith(KEY);
    expect(directus.decide).toHaveBeenCalledWith("s1", "APPROVED", null);
    expect(prisma.siteHubSubmissionDecision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: TENANT, submissionKey: KEY, actorId: USER, status: "PROCESSING" }),
    }));
    expect(prisma.siteHubSubmissionDecision.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "DECIDED", directusId: "s1" }),
    }));
    expect(result).toMatchObject({ idempotent: false, notification: { status: "NOT_CONFIRMED" } });
  });

  it("repete a mesma decisão sem nova chamada externa e recusa decisão divergente", async () => {
    const { service, directus } = setup(decision());
    const repeated = await service.decide(KEY, { decision: "APPROVED" }, TENANT, "OWNER", USER);
    expect(repeated).toMatchObject({ idempotent: true, decision: "APPROVED" });
    expect(directus.findByKey).not.toHaveBeenCalled();
    expect(directus.decide).not.toHaveBeenCalled();

    await expect(service.decide(KEY, { decision: "REJECTED", reason: "Outro motivo" }, TENANT, "OWNER", USER))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("marca falha externa sem confirmar a decisão", async () => {
    const { service, directus, prisma } = setup();
    directus.decide.mockRejectedValueOnce(new Error("Directus respondeu 500"));
    await expect(service.decide(KEY, { decision: "REJECTED", reason: "Preço acima do faixa" }, TENANT, "OWNER", USER))
      .rejects.toThrow("Directus respondeu 500");
    expect(prisma.siteHubSubmissionDecision.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED", lastError: "Directus respondeu 500" }),
    }));
  });
});
