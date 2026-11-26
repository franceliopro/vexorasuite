import { AsaasService } from "./asaas.service";

describe("AsaasService — clientes para o painel multi-provedor", () => {
  function setup() {
    const service = new AsaasService({} as any);
    jest.spyOn(service as any, "credentials").mockResolvedValue({ key: "key", sandbox: false });
    const request = jest.spyOn(service as any, "request").mockResolvedValue({
      data: [{
        id: "cus_1",
        name: "Ana Silva",
        email: "ana@teste.com",
        mobilePhone: "11999999999",
        cpfCnpj: "52998224725",
      }],
      hasMore: false,
      totalCount: 1,
    });
    return { service, request };
  }

  it("lista clientes reais do Asaas e mascara o documento", async () => {
    const { service, request } = setup();
    const result = await service.listFinanceCustomers("tenant-a", 10, 25);
    expect(result).toMatchObject({
      source: "PROVIDER_LIVE",
      provider: "ASAAS",
      environment: "PRODUCTION",
      offset: 10,
      limit: 25,
      hasMore: false,
      totalCount: 1,
    });
    expect(result.items[0]).toEqual({
      id: "cus_1",
      name: "Ana Silva",
      email: "ana@teste.com",
      phone: "11999999999",
      documentMasked: "529.***.***-25",
    });
    expect(request.mock.calls[0]![1]).toContain("customers?");
    expect(request.mock.calls[0]![1]).toContain("offset=10");
    expect(JSON.stringify(result)).not.toContain("52998224725");
  });
});
