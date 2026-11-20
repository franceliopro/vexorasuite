import { visionProviders } from "../../ai/vision-providers";
import { SiteLayoutVisionService } from "./site-layout-vision.service";
import type { LayoutImageInput } from "./layout-image";

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

jest.mock("../../ai/vision-providers", () => ({
  visionProviders: jest.fn(async (providers: unknown) => providers),
}));

const image: LayoutImageInput = {
  dataUrl: "data:image/jpeg;base64,/9j/AAAA",
  mimeType: "image/jpeg",
  fileName: "layout.jpg",
  width: 800,
  height: 600,
  bytes: 1234,
};

function setup() {
  const ai = { generate: jest.fn() } as any;
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        name: "Empresa",
        integrations: { assistant: { enabled: true, dailyAiLimit: 50 } },
      }),
    },
    $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn({})),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  return { service: new SiteLayoutVisionService(prisma, ai), ai, prisma };
}

describe("visão aplicada à imagem de layout", () => {
  afterEach(() => jest.clearAllMocks());

  it("devolve apenas estrutura sanitizada quando o modelo responde", async () => {
    const { service, ai, prisma } = setup();
    ai.generate.mockResolvedValue({
      text: JSON.stringify({
        sections: ["hero", "serviços", "depoimentos", "contato"],
        emphasis: "serviços",
        density: "generosa",
        confidence: 0.9,
        notes: "Layout com bastante espaço",
      }),
      model: "gpt-5",
      provider: "openai",
      usage: { totalTokens: 42 },
    });

    const result = await service.analyze({
      tenantId: "tenant-1",
      userId: "user-1",
      siteName: "Minha Empresa",
      prompt: "Clínica veterinária",
      image,
    });

    expect(result.brief?.sections).toEqual(["hero", "servicos", "depoimentos", "contato"]);
    expect(result.brief?.emphasis).toBe("servicos");
    expect(result.brief?.model).toBe("gpt-5");
    expect(result.warning).toBeUndefined();
    const messages = ai.generate.mock.calls[0][0];
    expect(messages[1].content[1]).toMatchObject({ type: "image_url", image_url: { url: image.dataUrl } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "sites.layout.vision" }) }),
    );
  });

  it("não chama um modelo que não enxerga imagem", async () => {
    const { service, ai } = setup();
    (visionProviders as jest.Mock).mockResolvedValueOnce([]);

    const result = await service.analyze({ tenantId: "tenant-1", siteName: "Minha Empresa", prompt: "", image });

    expect(result.brief).toBeUndefined();
    expect(result.warning).toContain("não tem visão");
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it("avisa quando a resposta não tem estrutura utilizável", async () => {
    const { service, ai } = setup();
    ai.generate.mockResolvedValue({ text: "não é json", model: "gpt-5", provider: "openai", usage: { totalTokens: 3 } });

    const result = await service.analyze({ tenantId: "tenant-1", siteName: "Minha Empresa", prompt: "", image });

    expect(result.brief).toBeUndefined();
    expect(result.warning).toContain("regras determinísticas");
  });
});
