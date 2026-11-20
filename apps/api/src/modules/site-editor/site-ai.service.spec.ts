import { BadGatewayException, BadRequestException, NotFoundException } from "@nestjs/common";
import { SiteAiService, deterministicPatch, hasPatch, safeUrl } from "./site-ai.service";

jest.mock("../../ai/creative-agent", () => ({
  resolveCreativeAgent: jest.fn(() => ({
    providers: [{ provider: "openai", model: "gpt-5", apiKey: "test-key" }],
    persona: "Você é a designer da empresa.",
  })),
}));

jest.mock("../../ai/ai-budget", () => ({
  dailyAiLimit: jest.fn(() => 100),
  reserveAiExecution: jest.fn().mockResolvedValue({}),
}));

const baseNode = () => ({
  id: "n_teste",
  type: "text",
  props: { content: "Texto original", tag: "p" },
  styles: { color: "#101d33" },
  children: [],
});

function setup() {
  const ai = { generate: jest.fn() } as any;
  const prisma = {
    site: { findFirst: jest.fn().mockResolvedValue({ id: "site-1" }) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ integrations: { assistant: { enabled: true } } }) },
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn({})),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  return { service: new SiteAiService(prisma, ai), ai, prisma };
}

describe("IA por bloco do editor", () => {
  it("aplica regras determinísticas sem chamar o modelo", async () => {
    const { service, ai, prisma } = setup();
    const result = await service.edit("site-1", "tenant-1", "user-1", baseNode(), "deixe o texto azul e centralizado");

    expect(result.appliedBy).toBe("rules");
    expect(result.node.styles).toMatchObject({ color: "#2563eb", textAlign: "center" });
    expect(ai.generate).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "site.ai.edit" }) }),
    );
  });

  it("usa o modelo para pedidos livres e aceita apenas o patch permitido", async () => {
    const { service, ai, prisma } = setup();
    ai.generate.mockResolvedValue({
      text: JSON.stringify({
        props: { content: "Novo texto", tag: "h2", href: "javascript:alert(1)" },
        styles: { color: "#ffffff", fontSize: "2rem", position: "fixed" },
        summary: "Texto atualizado",
      }),
      model: "gpt-5",
      provider: "openai",
      usage: { totalTokens: 42 },
    });

    const result = await service.edit("site-1", "tenant-1", "user-1", baseNode(), "deixe mais elegante e moderno");

    expect(result.appliedBy).toBe("model");
    expect(result.node.props).toMatchObject({ content: "Novo texto", tag: "h2" });
    expect(result.node.props).not.toHaveProperty("href");
    expect(result.node.styles).toMatchObject({ color: "#ffffff", fontSize: "2rem" });
    expect(result.node.styles).not.toHaveProperty("position");
    expect(result.tokensUsed).toBe(42);
    expect(ai.generate).toHaveBeenCalledTimes(1);
    const messages = ai.generate.mock.calls[0][0];
    expect(messages[1].content).toContain("pedido");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("rejeita resposta sem ajuste válido e não altera o bloco", async () => {
    const { service, ai } = setup();
    ai.generate.mockResolvedValue({ text: '{"summary":"nada feito"}', usage: { totalTokens: 5 } });
    await expect(
      service.edit("site-1", "tenant-1", "user-1", baseNode(), "faça algo completamente novo"),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("não expõe sites de outra empresa e valida a entrada", async () => {
    const { service, prisma } = setup();
    prisma.site.findFirst.mockResolvedValue(null);
    await expect(service.edit("site-1", "outra", "user-1", baseNode(), "deixe azul")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.site.findFirst.mockResolvedValue({ id: "site-1" });
    await expect(service.edit("site-1", "tenant-1", "user-1", baseNode(), "x")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.edit("site-1", "tenant-1", "user-1", { ...baseNode(), id: "../x" }, "azul")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("mantém apenas regras e URLs com esquema seguro", () => {
    expect(deterministicPatch(baseNode() as any, "centralize").styles.textAlign).toBe("center");
    expect(deterministicPatch(baseNode() as any, "sem espaçamento").styles.padding).toBe("0");
    expect(hasPatch(deterministicPatch(baseNode() as any, "pedido aleatório"))).toBe(false);
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("https://exemplo.com")).toBe("https://exemplo.com/");
    expect(safeUrl("/imagem.png")).toBe("/imagem.png");
  });
});
