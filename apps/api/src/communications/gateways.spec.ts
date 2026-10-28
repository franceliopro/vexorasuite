import { GatewaysController } from "./gateways.controller";
const req: any = {
  user: {
    tenantId: "11111111-1111-4111-8111-111111111111",
    sub: "22222222-2222-4222-8222-222222222222",
    role: "OWNER",
  },
};
describe("tenant communication routes", () => {
  const previous = { ...process.env };
  afterEach(() => {
    process.env = { ...previous };
    jest.restoreAllMocks();
  });
  it("does not expose live call capabilities or an origination handler", () => {
    const controller=new GatewaysController({} as any);
    const status=controller.status(req);
    expect(status).not.toHaveProperty("voice");
    expect(status).not.toHaveProperty("whatsappCalls");
    expect(status).not.toHaveProperty("aiCalls");
    expect(controller).not.toHaveProperty("call");
  });
  it("does not expose another company route or credentials", () => {
    process.env.JASMIN_BASE_URL = "https://gateway.example.test";
    process.env.JASMIN_TENANT_ROUTES = JSON.stringify({
      other: { username: "private", password: "hidden" },
    });
    const value = new GatewaysController({} as any).status(req);
    expect(value.sms.configured).toBe(false);
    expect(JSON.stringify(value)).not.toMatch(/private|hidden/);
  });
  it("refuses sending without a route belonging to this company", async () => {
    delete process.env.JASMIN_TENANT_ROUTES;
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new GatewaysController({} as any).sms(req, { content: "Hello" }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("preserves accented SMS using UCS2 and reports acceptance only", async () => {
    process.env.JASMIN_BASE_URL = "https://gateway.example.test";
    process.env.JASMIN_TENANT_ROUTES = JSON.stringify({
      [req.user.tenantId]: { username: "fixture", password: "fixture" },
    });
    const prisma: any = {
        auditLog: { update: jest.fn().mockResolvedValue({}) },
      },
      ctl = new GatewaysController(prisma);
    jest
      .spyOn(ctl as any, "reserve")
      .mockResolvedValue({ id: "audit", phone: "5511999999999" });
    const sender = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response('Success "123-456"'));
    const result = await ctl.sms(req, { content: "Olá", requestKey: "test" });
    const body = sender.mock.calls[0]![1]!.body as URLSearchParams;
    expect(body.get("hex-content")).toBe("004f006c00e1");
    expect(body.get("content")).toBeNull();
    expect(body.get("coding")).toBe("8");
    expect(result.accepted).toBe(true);
  });
  it("does not resubmit an already reserved request", async () => {
    process.env.JASMIN_BASE_URL = "https://gateway.example.test";
    process.env.JASMIN_TENANT_ROUTES = JSON.stringify({
      [req.user.tenantId]: { username: "fixture", password: "fixture" },
    });
    const tx: any = {
        $queryRaw: jest.fn(),
        auditLog: { findFirst: jest.fn().mockResolvedValue({ id: "already" }) },
      },
      prisma: any = {
        contact: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: "contact", phone: "5511999999999" }),
        },
        $transaction: async (fn: any) => fn(tx),
      },
      sender = jest.spyOn(global, "fetch");
    await expect(
      new GatewaysController(prisma).sms(req, {
        contactId: "33333333-3333-4333-8333-333333333333",
        requestKey: "44444444-4444-4444-8444-444444444444",
        content: "Hi",
      }),
    ).rejects.toThrow("já foi recebida");
    expect(sender).not.toHaveBeenCalled();
  });
});

