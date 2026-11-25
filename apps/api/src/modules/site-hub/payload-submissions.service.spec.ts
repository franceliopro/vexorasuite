import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";

let PayloadSubmissionsService: typeof import("./payload-submissions.service").PayloadSubmissionsService;
beforeAll(async () => {
  ({ PayloadSubmissionsService } = await import("./payload-submissions.service"));
});

const TENANT = "22222222-2222-4222-8222-222222222222";
const OTHER = "99999999-9999-4999-8999-999999999999";

const saved = {
  url: process.env.PAYLOAD_URL,
  token: process.env.PAYLOAD_TOKEN,
  fetch: globalThis.fetch,
};

function doc(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    tenantId: TENANT,
    submission_key: "aa-1024-2026",
    name: "Ana",
    email: "ana@example.com",
    phone: null,
    payload: { title: "Apartamento" },
    status: "pending",
    rejection_reason: null,
    property_id: null,
    createdAt: "2026-11-24T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, statusText: "erro", json: async () => body } as unknown as Response;
}

function setup(docs: unknown[] = [doc()]) {
  const fetchMock = jest.fn().mockResolvedValue(response({ docs }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { service: new PayloadSubmissionsService(), fetchMock };
}

describe("PayloadSubmissionsService", () => {
  beforeEach(() => {
    process.env.PAYLOAD_URL = "https://payload.example.com";
    process.env.PAYLOAD_TOKEN = "service-key";
  });

  afterEach(() => {
    globalThis.fetch = saved.fetch;
    if (saved.url === undefined) delete process.env.PAYLOAD_URL;
    else process.env.PAYLOAD_URL = saved.url;
    if (saved.token === undefined) delete process.env.PAYLOAD_TOKEN;
    else process.env.PAYLOAD_TOKEN = saved.token;
  });

  it("recusa configuração ausente com a mesma resposta para qualquer tenant", async () => {
    delete process.env.PAYLOAD_TOKEN;
    const service = new PayloadSubmissionsService();
    expect(() => service.assertConfigured(TENANT)).toThrow(ServiceUnavailableException);
    expect(() => service.assertConfigured(OTHER)).toThrow("não está configurada para esta empresa");
  });

  it("valida URL e exige HTTPS fora de localhost", () => {
    process.env.PAYLOAD_URL = "url-invalida";
    expect(() => new PayloadSubmissionsService().assertConfigured(TENANT)).toThrow(ServiceUnavailableException);

    process.env.PAYLOAD_URL = "http://payload.example.com";
    expect(() => new PayloadSubmissionsService().assertConfigured(TENANT)).toThrow("HTTPS");

    process.env.PAYLOAD_URL = "http://localhost:3000";
    expect(() => new PayloadSubmissionsService().assertConfigured(TENANT)).not.toThrow();
  });

  it("filtra submissões pendentes por tenant e normaliza o documento", async () => {
    const { service, fetchMock } = setup([doc(), doc({ id: "s2", tenantId: OTHER, submission_key: "outra" })]);
    const rows = await service.listPending(TENANT);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "s1", tenantId: TENANT, submission_key: "aa-1024-2026", status: "pending" });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("where%5Bstatus%5D%5Bequals%5D=pending");
    expect(url).toContain(TENANT);
    expect(url).toContain("depth=0");
  });

  it("nunca devolve um documento de outro tenant", async () => {
    const { service } = setup([doc({ tenantId: OTHER })]);
    expect(await service.findByKey(TENANT, "aa-1024-2026")).toBeNull();
  });

  it("confirma a posse do documento antes de mudar o status", async () => {
    const { service, fetchMock } = setup([doc()]);
    await service.decide(TENANT, "s1", "REJECTED", "Fora do padrão");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const patch = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(patch.method).toBe("PATCH");
    expect(JSON.parse(String(patch.body))).toEqual({ status: "rejected", rejection_reason: "Fora do padrão" });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/submission/s1");
  });

  it("não pode aprovar um documento de outro tenant", async () => {
    const { service, fetchMock } = setup([doc({ tenantId: OTHER })]);
    await expect(service.decide(TENANT, "s1", "APPROVED", null)).rejects.toThrow("não encontrada");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não muda o status de uma submissão que saiu de pending", async () => {
    const { service, fetchMock } = setup([doc({ status: "approved" })]);
    await expect(service.decide(TENANT, "s1", "APPROVED", null)).rejects.toThrow("não está mais pendente");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("transforma falha de transporte em falha de integração, sem prometer decisão", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    const service = new PayloadSubmissionsService();
    await expect(service.listPending(TENANT)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("não aceita resposta de erro como sucesso", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response({ errors: [{ message: "forbidden" }] }, false, 403)) as unknown as typeof fetch;
    const service = new PayloadSubmissionsService();
    await expect(service.listPending(TENANT)).rejects.toThrow("CMS respondeu 403");
  });

  it("usa o token apenas no cabeçalho da requisição ao servidor", async () => {
    const { service, fetchMock } = setup();
    await service.listPending(TENANT);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe("users API-Key service-key");
  });
});
