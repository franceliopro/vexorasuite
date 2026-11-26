import { FinanceController } from "./finance.controller";

describe("FinanceController — assinaturas e exclusão no Asaas", () => {
  function setup(role = "ADMIN") {
    const asaas: any = {
      createSubscription: jest.fn().mockResolvedValue({ subscription: { id: "sub_test" } }),
      removeSubscription: jest.fn().mockResolvedValue({ deleted: true, subscriptionId: "sub_test" }),
      removeCustomer: jest.fn().mockResolvedValue({ deleted: true, customerId: "cus_test" }),
    };
    const providers: any = {
      list: jest.fn().mockResolvedValue([]),
      describe: jest.fn().mockResolvedValue({ provider: "ASAAS", label: "Asaas" }),
    };
    const stripe: any = {
      financeDashboard: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", totals: {} }),
      listFinanceCharges: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      listFinanceCustomers: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      listFinanceCatalog: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      listFinanceSubscriptions: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      refundFinanceCharge: jest.fn().mockResolvedValue({ executed: true, refundId: "re_1" }),
    };
    const infinitePayFinance: any = {
      dashboard: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", totals: {} }),
      listCharges: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", items: [] }),
      listCustomers: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", items: [] }),
      listCatalog: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", items: [] }),
    };
    const controller = new FinanceController({} as any, asaas, {} as any, providers, stripe, infinitePayFinance);
    const request: any = { user: { tenantId: "tenant-a", sub: "user-1", role } };
    return { controller, asaas, providers, stripe, infinitePayFinance, request };
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

describe("FinanceController — superfície multi-provedor", () => {
  function setup(role = "ADMIN") {
    const asaas: any = {
      listPortfolio: jest.fn().mockResolvedValue({ source: "ASAAS_LIVE", items: [] }),
      listFinanceCustomers: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", items: [] }),
      listCatalog: jest.fn().mockResolvedValue({ source: "ASAAS_LIVE", products: [] }),
      financeListings: jest.fn().mockResolvedValue({ source: "ASAAS_LIVE", items: [] }),
      executiveDashboard: jest.fn().mockResolvedValue({ source: "ASAAS_LIVE", totals: {} }),
    };
    const stripe: any = {
      financeDashboard: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", totals: {} }),
      listFinanceCharges: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      listFinanceCustomers: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      listFinanceCatalog: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      listFinanceSubscriptions: jest.fn().mockResolvedValue({ source: "PROVIDER_LIVE", provider: "STRIPE", items: [] }),
      refundFinanceCharge: jest.fn().mockResolvedValue({ executed: true, refundId: "re_1" }),
    };
    const infinitePayFinance: any = {
      dashboard: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", totals: {} }),
      listCharges: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", items: [] }),
      listCustomers: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", items: [] }),
      listCatalog: jest.fn().mockResolvedValue({ source: "LOCAL_RECORDS", provider: "INFINITEPAY", items: [] }),
    };
    const providers: any = {
      list: jest.fn().mockResolvedValue([{ provider: "ASAAS", verification: { status: "NOT_VERIFIED" } }]),
      describe: jest.fn().mockResolvedValue({ provider: "ASAAS", verification: { status: "NOT_VERIFIED" } }),
    };
    const controller = new FinanceController({} as any, asaas, {} as any, providers, stripe, infinitePayFinance);
    const request: any = { user: { tenantId: "tenant-a", sub: "user-1", role } };
    return { controller, asaas, stripe, infinitePayFinance, providers, request };
  }

  it("expõe capacidades com verificação explícita e nunca transforma configuração em conexão", async () => {
    const { controller, providers, request } = setup();
    await expect(controller.listProviders(request)).resolves.toEqual([{ provider: "ASAAS", verification: { status: "NOT_VERIFIED" } }]);
    expect(providers.list).toHaveBeenCalledWith("tenant-a");
    await expect(controller.describeProvider(request, "stripe")).resolves.toEqual({ provider: "ASAAS", verification: { status: "NOT_VERIFIED" } });
    expect(providers.describe).toHaveBeenCalledWith("tenant-a", "stripe");
  });

  it("usa dados reais do Asaas e da Stripe, com origem comum", async () => {
    const { controller, asaas, stripe, request } = setup();
    await expect(controller.providerDashboard(request, "Asaas", "6")).resolves.toMatchObject({ provider: "ASAAS", source: "PROVIDER_LIVE" });
    await expect(controller.providerCharges(request, "ASAAS")).resolves.toMatchObject({ provider: "ASAAS", source: "PROVIDER_LIVE" });
    await expect(controller.providerDashboard(request, "stripe", "6")).resolves.toMatchObject({ provider: "STRIPE", source: "PROVIDER_LIVE" });
    await expect(controller.providerCharges(request, "STRIPE", undefined, undefined, undefined, "0", "50")).resolves.toMatchObject({ provider: "STRIPE", source: "PROVIDER_LIVE" });
    expect(stripe.listFinanceCharges).toHaveBeenCalledWith("tenant-a", 50);
    expect(asaas.listPortfolio).toHaveBeenCalledWith("tenant-a", { status: undefined, dueFrom: undefined, dueTo: undefined, offset: 0, limit: 50 });
  });

  it("mantém o InfinitePay como painel local e parcial", async () => {
    const { controller, infinitePayFinance, request } = setup();
    await expect(controller.providerDashboard(request, "InfinitePay", "3")).resolves.toMatchObject({ source: "LOCAL_RECORDS", provider: "INFINITEPAY" });
    await expect(controller.providerCharges(request, "InfinitePay")).resolves.toMatchObject({ source: "LOCAL_RECORDS", provider: "INFINITEPAY" });
    expect(infinitePayFinance.dashboard).toHaveBeenCalledWith("tenant-a", expect.objectContaining({ months: 3 }));
  });

  it("recusa capacidades não documentadas em vez de devolver sucesso vazio", async () => {
    const { controller, request } = setup();
    await expect(controller.providerSubscriptions(request, "InfinitePay")).rejects.toThrow(/não está disponível/);
    await expect(controller.providerRefund(request, "Asaas", { confirm: true, paymentIntentId: "pi_test" })).rejects.toThrow(/não está disponível/);
    await expect(controller.providerRefund(request, "InfinitePay", { confirm: true, paymentIntentId: "pi_test" })).rejects.toThrow(/não está disponível/);
  });

  it("só executa estorno na Stripe após confirmação explícita e registra o usuário", async () => {
    const { controller, stripe, request } = setup();
    await expect(controller.providerRefund(request, "Stripe", { paymentIntentId: "pi_test" })).rejects.toThrow(/Confirme explicitamente/);
    await expect(controller.providerRefund(request, "Stripe", { paymentIntentId: "pi_test", confirm: true })).resolves.toEqual({ executed: true, refundId: "re_1" });
    expect(stripe.refundFinanceCharge).toHaveBeenCalledWith("tenant-a", "pi_test", "user-1");
  });

  it("nega a superfície genérica a papéis sem acesso financeiro", async () => {
    const { controller, providers, stripe, request } = setup("MANAGER");
    expect(() => controller.listProviders(request)).toThrow("Acesso financeiro restrito");
    await expect(controller.providerCharges(request, "ASAAS")).rejects.toThrow("Acesso financeiro restrito");
    await expect(controller.providerRefund(request, "STRIPE", { confirm: true })).rejects.toThrow("Acesso financeiro restrito");
    expect(providers.list).not.toHaveBeenCalled();
    expect(stripe.refundFinanceCharge).not.toHaveBeenCalled();
  });
});
