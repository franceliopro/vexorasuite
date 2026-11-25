import { AssistantController } from "./assistant.controller";

const root = { assistant: { enabled: true, agents: [] } };

function fixture() {
  const prisma: any = {
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ integrations: root }) },
    conversation: { count: jest.fn().mockResolvedValue(2) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    contact: { count: jest.fn().mockResolvedValue(1) },
    workTask: { count: jest.fn().mockResolvedValue(0) },
  };
  const controller = new AssistantController(prisma, {} as any, {} as any, {} as any, {} as any);
  return { controller, prisma };
}

const req = (role = "OWNER", allowedModules = ["INBOX", "FINANCE"]) => ({ user: { tenantId: "tenant-a", sub: "user-a", role, allowedModules, departmentIds: [] } }) as any;

describe("assistente direto ao ponto", () => {
  it("responde capacidades pelo ask sem acionar IA", async () => {
    const { controller } = fixture();
    const result = await controller.ask(req(), { question: "O que você faz?" });
    expect(result).toMatchObject({ source: "rules", usedAi: false });
    expect(result.answer).toContain("Atendimento");
    expect(result.answer).toContain("Financeiro");
  });

  it("mantém o fallback seguro para o que não é conhecido", async () => {
    const { controller } = fixture();
    const result = await controller.ask(req(), { question: "Qual é o preço da ação da empresa?" });
    expect(result.answer).toContain("Ainda não tenho uma automação segura");
  });

  it("recusa financeiro quando o módulo foi negado, mesmo para OWNER", async () => {
    const { controller, prisma } = fixture();
    await expect(controller.ask(req("OWNER", ["INBOX"]), { question: "Quais são as informações financeiras?" })).rejects.toThrow("módulo Financeiro");
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("traz contagens tenant-scoped em uma frase direta", async () => {
    const { controller, prisma } = fixture();
    const result = await controller.ask(req(), { question: "Quantas conversas temos?" });
    expect(result.answer).toContain("2 conversas abertas");
    expect(prisma.conversation.count.mock.calls[0][0].where.tenantId).toBe("tenant-a");
  });
});
