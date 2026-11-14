import { resolveCreativeAgent } from "./creative-agent";
import { WEB_DESIGNER_AGENT_ID } from "./web-designer-agent";

describe("Design Gráfico & Web exclusivo", () => {
  const previous = { ...process.env };
  afterEach(() => { process.env = { ...previous }; });
  it("usa a seleção do agente e nunca acrescenta o Ollama global", () => {
    process.env.OPENAI_API_KEY = "test";
    process.env.OLLAMA_BASE_URL = "http://ollama:11434";
    process.env.OLLAMA_DEFAULT_MODEL = "geral";
    const result = resolveCreativeAgent({
      aiCostPolicy: { freeFirst: true, allowPaidFallback: true },
      assistant: { enabled: true, llm: { provider: "ollama", model: "atendimento" }, fallbackModels: [{ provider: "ollama", model: "backup" }],
        agents: [{ id: WEB_DESIGNER_AGENT_ID, enabled: true, llm: { provider: "openai", model: "designer" }, instructions: "Direção editorial própria" }] },
    }, "tenant");
    expect(result.providers.map(({ provider, model }) => [provider, model])).toEqual([["openai", "designer"]]);
    expect(result.persona).toContain("Direção editorial própria");
  });
  it("recusa fallback geral quando o agente está desativado ou sem seleção", () => {
    const root = (enabled: boolean) => ({ assistant: { enabled: true, llm: { provider: "ollama", model: "geral" },
      agents: [{ id: WEB_DESIGNER_AGENT_ID, enabled }] } });
    expect(() => resolveCreativeAgent(root(false), "tenant")).toThrow("Ative o agente Design Gráfico & Web");
    expect(() => resolveCreativeAgent(root(true), "tenant")).toThrow("Selecione o provedor e o modelo");
  });
});
