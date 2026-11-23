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
