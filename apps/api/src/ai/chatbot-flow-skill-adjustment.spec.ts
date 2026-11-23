import { compileChatbotFlow } from "./chatbot-flow-skill";

describe("AJustes do assistente no Chatbot", () => {
  it("preserva canais, gatilho, configuração e posição durante um ajuste de texto", () => {
    const checkout = {
      id: "payment",
      title: "Consultar pagamento",
      kind: "payment.status",
      message: "",
      config: '{"provider":"INFINITEPAY"}',
      options: ["Continuar"],
      transitions: { Continuar: "reply" },
      position: { x: 80, y: 250 },
    };
    const reply = { id: "reply", title: "Responder", kind: "text", message: "Texto anterior", options: [] };
    const current = {
      name: "Atendimento",
      welcome: "Olá!",
      channelIds: ["inbox"],
      triggers: [{ kind: "keyword", keyword: "pagamento" }],
      steps: [checkout, reply],
    };
    const proposal = JSON.stringify({
      ...current,
      channelIds: ["canal-inventado"],
      triggers: [{ kind: "message" }],
      steps: [{ ...checkout, config: '{"provider":"STRIPE"}' }, { ...reply, message: "Consulte seu pagamento." }],
    });
    expect(compileChatbotFlow(proposal, [], current)?.draft).toMatchObject({
      channelIds: current.channelIds,
      triggers: current.triggers,
      steps: [checkout, { ...reply, message: "Consulte seu pagamento." }],
    });
  });
});

describe("Blocos de integração em propostas novas", () => {
  const draftWith = (kind: string, config: Record<string, string | number>) => JSON.stringify({
    name: "Atendimento",
    welcome: "Olá!",
    steps: [
      { id: "integration", kind, config, options: ["Continuar"], transitions: { Continuar: "next" } },
      { id: "next", kind: "text", message: "Vamos conferir o resultado.", options: [] },
    ],
  });

  it.each([
    ["payment.status", { provider: "infinitepay" }, { provider: "INFINITEPAY" }],
    ["calendar.availability", { start: "{{horario}}", minutes: 30 }, { start: "{{horario}}", minutes: "30" }],
    ["calendar.book", { start: "{{horario}}", minutes: 30, title: "Atendimento" }, { start: "{{horario}}", minutes: "30", title: "Atendimento" }],
    ["task.reminder", { title: "Retorno", minutes: 10 }, { title: "Retorno", minutes: "10" }],
  ])("compiles a valid %s block", (kind, input, expected) => {
    const compiled = compileChatbotFlow(draftWith(kind, input), []);
    expect(compiled?.draft.steps[0]?.kind).toBe(kind);
    expect(JSON.parse(compiled?.draft.steps[0]?.config ?? "{}")).toEqual(expected);
  });

  it("rejects invalid integrations through the flow validator", () => {
    expect(compileChatbotFlow(draftWith("payment.status", { provider: "unknown" }), [])).toBeUndefined();
    expect(compileChatbotFlow(draftWith("calendar.book", { start: "{{horario}}", minutes: 30 }), [])).toBeUndefined();
  });
});
