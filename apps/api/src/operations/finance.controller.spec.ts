import { FinanceController } from "./finance.controller";

describe("FinanceController — assinaturas e exclusão no Asaas", () => {
  function setup(role = "ADMIN") {
    const asaas: any = {
      createSubscription: jest.fn().mockResolvedValue({ subscription: { id: "sub_test" } }),
      removeSubscription: jest.fn().mockResolvedValue({ deleted: true, subscriptionId: "sub_test" }),
      removeCustomer: jest.fn().mockResolvedValue({ deleted: true, customerId: "cus_test" }),
    };
    const controller = new FinanceController({} as any, asaas, {} as any);
    const request: any = { user: { tenantId: "tenant-a", sub: "user-1", role } };
    return { controller, asaas, request };
  }

  it("encaminha catalogItemId e as datas sem deixar o navegador definir nome ou preço", async () => {
    const { controller, asaas, request } = setup();
    const body = {
      catalogItemId: "11111111-1111-4111-8111-111111111111",
      nextDueDate: "2026-12-01",
      endDate: "2027-11-30",
      service: "Nome inventado",
      value: 1,
    };

    await controller.createSubscription(request, body);

    expect(asaas.createSubscription).toHaveBeenCalledWith("tenant-a", { ...body, userId: "user-1" });
  });

  it("exclui assinatura com escopo do tenant e identidade do usuário", async () => {
    const { controller, asaas, request } = setup();

    await expect(controller.removeSubscription(request, "sub_test")).resolves.toEqual({ deleted: true, subscriptionId: "sub_test" });
    expect(asaas.removeSubscription).toHaveBeenCalledWith("tenant-a", "sub_test", "user-1");
  });

  it("exclui cliente com escopo do tenant e identidade do usuário", async () => {
    const { controller, asaas, request } = setup();

    await expect(controller.removeCustomer(request, "cus_test")).resolves.toEqual({ deleted: true, customerId: "cus_test" });
    expect(asaas.removeCustomer).toHaveBeenCalledWith("tenant-a", "cus_test", "user-1");
  });

  it("nega exclusão a papéis sem acesso financeiro", async () => {
    const { controller, asaas, request } = setup("MANAGER");

    expect(() => controller.removeSubscription(request, "sub_test")).toThrow("Acesso financeiro restrito");
    expect(() => controller.removeCustomer(request, "cus_test")).toThrow("Acesso financeiro restrito");
    expect(asaas.removeSubscription).not.toHaveBeenCalled();
    expect(asaas.removeCustomer).not.toHaveBeenCalled();
  });
});
