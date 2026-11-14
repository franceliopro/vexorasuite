import { probeConnections } from "./provider-status";

jest.mock("./provider-credentials", () => ({
  ...jest.requireActual("./provider-credentials"),
  providerApiKey: jest.fn((provider: string) => (provider === "groq" || provider === "openrouter" ? "key-" + provider : undefined)),
}));

describe("probeConnections", () => {
  afterEach(() => { jest.restoreAllMocks(); });
  it("marca provedor sem chave como not_configured e só chama rede para quem tem chave", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () => new Response("{}", { status: 200 }));
    const probes = await probeConnections({}, "tenant");
    expect(probes.find(p => p.provider === "openai")?.status).toBe("not_configured");
    expect(probes.find(p => p.provider === "gemini")?.status).toBe("not_configured");
    expect(probes.find(p => p.provider === "groq")?.status).toBe("connected");
    expect(probes.find(p => p.provider === "openrouter")?.status).toBe("connected");
    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(u => u.includes("groq"))).toBe(true);
    expect(urls.some(u => u.includes("openrouter"))).toBe(true);
    expect(urls.some(u => u.includes("api.openai.com"))).toBe(false);
    expect(urls.some(u => u.includes("search.brave.com"))).toBe(false);
  });
  it("mapeia 200 como conectada, 403 como rejeitada e exceção como offline", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes("groq")) return new Response("{}", { status: 200 });
      if (url.includes("openrouter")) return new Response("{}", { status: 403 });
      throw new Error("timed out");
    });
    const probes = await probeConnections({}, "tenant");
    expect(probes.find(p => p.provider === "groq")).toMatchObject({ status: "connected", message: "Conexão ativa" });
    expect(probes.find(p => p.provider === "openrouter")).toMatchObject({ status: "rejected", httpStatus: 403 });
  });
});
