import { MusicSchoolReadService } from "./music-school-read.service";

const TENANT = "11111111-1111-4111-8111-111111111111";
const DEPT = "44444444-4444-4444-8444-444444444444";
const CONTACT = "66666666-6666-4666-8666-666666666666";

describe("Escola de Música — leituras", () => {
  it("devolve apenas departamentos ativos e contatos do tenant autenticado", async () => {
    const department = {
      findMany: jest.fn(async (_args: unknown) => [{ id: DEPT, name: "Piano" }]),
    };
    const contact = {
      findMany: jest.fn(async (_args: unknown) => [{ id: CONTACT, name: "Ana" }]),
    };
    const service = new MusicSchoolReadService({ department, contact } as any);
    const result = await service.options(TENANT);
    expect(result).toEqual({ departments: [{ id: DEPT, name: "Piano" }], contacts: [{ id: CONTACT, name: "Ana" }] });
    expect(department.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT, isActive: true });
    expect(contact.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(department.findMany.mock.calls[0][0].take).toBe(200);
  });

  it("rejeita identificadores inválidos nos filtros de leitura", async () => {
    const service = new MusicSchoolReadService({} as any);
    await expect(service.listAttendances(TENANT, "turma-1")).rejects.toThrow("Turma inválida");
    await expect(service.listBalances(TENANT, "aluno-1")).rejects.toThrow("Aluno inválido");
    await expect(service.listAttendances(TENANT, undefined, "2026-13-01")).rejects.toThrow("Data inicial inválida");
  });
});
