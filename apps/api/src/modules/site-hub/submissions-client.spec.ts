import { createSubmissionsClient } from "./submissions-client";

describe("createSubmissionsClient", () => {
  const directus: any = { name: "directus" };
  const payload: any = { name: "payload" };
  const original = process.env.SUBMISSIONS_PROVIDER;

  afterEach(() => {
    if (original === undefined) delete process.env.SUBMISSIONS_PROVIDER;
    else process.env.SUBMISSIONS_PROVIDER = original;
  });

  it("mantém o Directus como padrão até a instância Payload ser validada", () => {
    delete process.env.SUBMISSIONS_PROVIDER;
    expect(createSubmissionsClient(directus, payload)).toBe(directus);
  });

  it("seleciona o Payload explicitamente", () => {
    expect(createSubmissionsClient(directus, payload, " payload ")).toBe(payload);
  });

  it("recusa valor desconhecido sem tentar nenhum cliente", () => {
    expect(() => createSubmissionsClient(directus, payload, "outra-coisa")).toThrow("SUBMISSIONS_PROVIDER");
  });

  it("não vaza token ou estado de configuração na mensagem de erro", () => {
    process.env.SUBMISSIONS_PROVIDER = "secret-value";
    expect(() => createSubmissionsClient(directus, payload)).not.toThrow(/secret-value/);
  });
});
