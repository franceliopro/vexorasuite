import { assistantCapabilities, resolveAssistantDemandContext } from "./assistant-demand-context";

const req = (overrides: Record<string, unknown> = {}) => ({
  user: { tenantId: "tenant-a", sub: "user-a", role: "OWNER", allowedModules: ["INBOX", "FINANCE", "AUTOMATION"], departmentIds: ["dept-a"], ...overrides },
}) as any;

describe("contexto direto da demanda", () => {
  it("responde capacidades de forma curta e filtrada por módulo, sem IA", () => {
    const answer = assistantCapabilities(["INBOX", "FINANCE"]);
    expect(answer).toContain("Atendimento");
    expect(answer).toContain("Financeiro");
    expect(answer).not.toContain("Agenda");
    expect(answer).toContain("Nenhuma IA foi acionada");
    expect(answer.length).toBeLessThan(600);
  });

  it("traz contagem de atendimento tenant-scoped quando há departamentos", async () => {
    const prisma: any = { conversation: { count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(7) } };
    const result = await resolveAssistantDemandContext(prisma, req(), "Resumo do atendimento");
    expect(result).toMatchObject({ source: "database", usedAi: false, tokensUsed: 0, context: { open: 3, resolved: 7 } });
    expect(result!.answer).toContain("nos seus departamentos");
    const where = prisma.conversation.count.mock.calls[0][0].where;
    expect(where.tenantId).toBe("tenant-a");
    expect(where.departmentId).toEqual({ in: ["dept-a"] });
  });

  it("devolve null para pedido não reconhecido ou sem autorização", async () => {
    const prisma: any = { conversation: { count: jest.fn() } };
    expect(await resolveAssistantDemandContext(prisma, req(), "Crie uma propaganda da empresa")).toBeNull();
    expect(await resolveAssistantDemandContext(prisma, req({ role: "AGENT" }), "Resumo do atendimento")).toBeNull();
    expect(prisma.conversation.count).not.toHaveBeenCalled();
  });
});
