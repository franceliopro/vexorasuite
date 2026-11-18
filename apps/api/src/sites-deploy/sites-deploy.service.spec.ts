import { SitesDeployService } from "./sites-deploy.service";
import { encryptCloudflareToken } from "./cloudflare-credentials";

process.env.INTEGRATION_ENCRYPTION_KEY = "test-key-with-at-least-32-characters!!";

const tenantId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const siteId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const integrations = {
  cloudflare: {
    accountId: "c".repeat(32),
    apiToken: { encryptedKey: encryptCloudflareToken(tenantId, "token-de-teste-1234567890"), updatedAt: new Date().toISOString() },
  },
};

const siteRow = {
  id: siteId,
  tenantId,
  slug: "clinica-vida",
  name: "Clínica Vida",
  primaryColor: "#0E7A5C",
  accentColor: "#6258DF",
  logoUrl: null,
  businessArea: "Saúde",
  domain: null,
  domainStatus: "NONE",
  pages: [
    { id: "p1", kind: "HOME", slug: "inicio", title: "Início", sortOrder: 0, hidden: false, blocks: [{ id: "b1", type: "hero", content: { title: "Bem-vindo" }, sortOrder: 0, hidden: false }] },
  ],
  items: [],
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "dep-1", tenantId, siteId, projectName: "vexora-site-clinica-vida", status: "READY",
    sourceHash: "hash", branch: "main", providerDeploymentId: "cf-1", url: "https://proj.pages.dev",
    pageCount: 3, fileCount: 4, totalBytes: 100, error: null,
    startedAt: new Date(), finishedAt: new Date(), createdAt: new Date(), ...overrides,
  };
}

function prismaMock(overrides: Record<string, any> = {}) {
  return {
    tenant: { findUnique: jest.fn().mockResolvedValue({ integrations }), update: jest.fn().mockResolvedValue({}) },
    site: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any = {}) => (where?.domain ? null : siteRow)),
      update: jest.fn().mockResolvedValue({}),
    },
    siteAsset: { findMany: jest.fn().mockResolvedValue([]) },
    siteDeployment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => row({ ...data, id: "dep-1" })),
      update: jest.fn().mockImplementation(async ({ data }: any) => row(data)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    siteDomain: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation(async ({ create }: any) => ({ id: "dom-1", createdAt: new Date(), ...create })),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: "dom-1", createdAt: new Date(), ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  } as any;
}

const fakeClient = (overrides: Record<string, any> = {}) => ({
  verifyToken: jest.fn().mockResolvedValue({ status: "active" }),
  ensureProject: jest.fn().mockResolvedValue({ name: "proj" }),
  createDeployment: jest.fn().mockResolvedValue({ id: "cf-1", url: "https://proj.pages.dev", latest_stage: { status: "success" } }),
  getDeployment: jest.fn().mockResolvedValue({ id: "cf-1", url: "https://proj.pages.dev", latest_stage: { status: "success" } }),
  createDomain: jest.fn().mockResolvedValue({ name: "www.clinica.com.br", status: "pending", validation_data: {} }),
  getDomain: jest.fn().mockResolvedValue({ name: "www.clinica.com.br", status: "pending", validation_data: {} }),
  deleteDomain: jest.fn().mockResolvedValue(undefined),
  findZoneForHostname: jest.fn().mockResolvedValue(null),
  listDnsRecords: jest.fn().mockResolvedValue([]),
  createCname: jest.fn().mockResolvedValue({ id: "rec-1", type: "CNAME", name: "www.clinica.com.br", content: "proj.pages.dev", proxied: true }),
  ...overrides,
});

describe("SitesDeployService", () => {
  it("reaproveita uma publicação READY com o mesmo conteúdo (idempotência)", async () => {
    const prisma = prismaMock();
    prisma.siteDeployment.findFirst.mockResolvedValue(row());
    const service = new SitesDeployService(prisma);
    const clientFor = jest.spyOn(service as any, "clientFor");
    const result = await service.deploy(tenantId, "user-1", siteId, {});
    expect(result.reused).toBe(true);
    expect(result.deployment.status).toBe("READY");
    expect(clientFor).not.toHaveBeenCalled();
    expect(prisma.siteDeployment.create).not.toHaveBeenCalled();
  });

  it("renderiza, publica e persiste o status READY", async () => {
    const prisma = prismaMock();
    const service = new SitesDeployService(prisma);
    const client = fakeClient();
    (service as any).clientFor = () => client;

    const result = await service.deploy(tenantId, "user-1", siteId, { commitMessage: "primeira" });

    expect(client.createDeployment).toHaveBeenCalledTimes(1);
    const payload = client.createDeployment.mock.calls[0][0];
    expect(payload.projectName).toBe("vexora-site-clinica-vida");
    expect(payload.files.has("index.html")).toBe(true);
    expect(payload.files.has("assets/site.css")).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.deployment.status).toBe("READY");
    expect(prisma.siteDeployment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY", providerDeploymentId: "cf-1" }) }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "site.deploy" }) }));
  });

  it("marca ERROR quando a Cloudflare falha e não vaza o token", async () => {
    const prisma = prismaMock();
    const service = new SitesDeployService(prisma);
    (service as any).clientFor = () => fakeClient({ createDeployment: jest.fn().mockRejectedValue(new Error("401 token-de-teste-1234567890 inválido")) });
    const error = await service.deploy(tenantId, "user-1", siteId, {}).catch((reason) => reason);
    expect(String(error.message)).toContain("Não foi possível publicar");
    expect(String(error.message)).not.toContain("token-de-teste-1234567890");
    expect(prisma.siteDeployment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ERROR" }) }));
  });

  it("vincula domínio e cria CNAME na zona do cliente", async () => {
    const prisma = prismaMock();
    const service = new SitesDeployService(prisma);
    const client = fakeClient({ findZoneForHostname: jest.fn().mockResolvedValue({ id: "zone-1", name: "clinica.com.br" }) });
    (service as any).clientFor = () => client;

    const result = await service.attachDomain(tenantId, "user-1", siteId, { hostname: "www.clinica.com.br" });

    expect(client.createDomain).toHaveBeenCalledWith("vexora-site-clinica-vida", "www.clinica.com.br");
    expect(client.createCname).toHaveBeenCalledWith("zone-1", "www.clinica.com.br", "vexora-site-clinica-vida.pages.dev");
    expect(result.domainStatus).toBe("PENDING_DNS");
    expect(result.dns).toMatchObject({ action: "AUTO", recordId: "rec-1", type: "CNAME" });
    expect(prisma.site.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ domain: "www.clinica.com.br", domainStatus: "PENDING_DNS" }) }));
  });

  it("ativa o domínio quando a Cloudflare confirma", async () => {
    const prisma = prismaMock();
    prisma.siteDomain.findUnique.mockResolvedValue({ id: "dom-1", siteId, hostname: "www.clinica.com.br", providerStatus: "PENDING", dnsRecord: {}, validation: {}, lastCheckedAt: new Date(), createdAt: new Date() });
    const service = new SitesDeployService(prisma);
    const client = fakeClient({ getDomain: jest.fn().mockResolvedValue({ name: "www.clinica.com.br", status: "active", validation_data: {} }) });
    (service as any).clientFor = () => client;

    const result = await service.verifyDomain(tenantId, "user-1", siteId);
    expect(result.active).toBe(true);
    expect(result.domainStatus).toBe("ACTIVE");
    expect(prisma.site.update).toHaveBeenCalledWith(expect.objectContaining({ data: { domainStatus: "ACTIVE" } }));
  });

  it("recusa hostname inválido e domínio pages.dev", async () => {
    const service = new SitesDeployService(prismaMock());
    await expect(service.attachDomain(tenantId, "user-1", siteId, { hostname: "não é domínio" })).rejects.toThrow(/Domínio inválido/);
    await expect(service.attachDomain(tenantId, "user-1", siteId, { hostname: "site.pages.dev" })).rejects.toThrow(/domínio próprio/);
  });

  it("reconcilia publicação pendente sem duplicar o job", async () => {
    const prisma = prismaMock();
    prisma.siteDeployment.findMany.mockResolvedValue([row({ status: "UPLOADING", finishedAt: null })]);
    const service = new SitesDeployService(prisma);
    const client = fakeClient();
    (service as any).clientFor = () => client;
    await service.reconcile();
    expect(client.getDeployment).toHaveBeenCalledWith("vexora-site-clinica-vida", "cf-1");
    expect(prisma.siteDeployment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY" }) }));
  });
});
