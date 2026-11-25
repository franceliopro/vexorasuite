import { applyFlowPatch, chatbotFlowDirectSkill, flowOutline, parseFlowPatch } from "./chatbot-flow-direct";
import { compileChatbotFlow } from "./chatbot-flow-skill";

const current = {
  name: "Fluxo Rastreabem",
  welcome: "Olá! Bem-vindo à Rastreabem.",
  channelIds: ["draft"],
  triggers: [{ kind: "message" as const }],
  steps: [
    { id: "menu", kind: "buttons", title: "Menu principal", message: "Escolha uma opção", options: ["Rastreamento", "Suporte"], transitions: { Rastreamento: "rastreamento", Suporte: "suporte" } },
    { id: "rastreamento", kind: "text", title: "Rastreamento", message: "Consulte seu veículo.", options: [] },
    { id: "suporte", kind: "human.handoff", title: "Suporte", message: "", options: [], config: '{"targetMode":"QUEUE"}' },
  ],
};

describe("Execução direta do assistente de fluxo", () => {
  it("entende o comando natural e acrescenta opção, bloco e conexão sem reescrever o fluxo", () => {
    const raw = JSON.stringify({
      operations: [
        { op: "addOption", block: "Menu principal", option: "2ª Via Boleto (Rastreabem)" },
        { op: "addBlock", id: "via-boleto", title: "2ª Via Boleto (Rastreabem)", kind: "text", message: "Para emitir a 2ª via do boleto, informe os dados da cobrança.", after: "Menu principal" },
        { op: "connect", from: "Menu principal", option: "2ª Via Boleto (Rastreabem)", to: "via-boleto" },
      ],
    });
    const patch = parseFlowPatch(raw);
    expect(patch).toBeDefined();
    const next = applyFlowPatch(current, patch!.operations);
    expect(next).toBeDefined();
    const menu = next!.steps.find(step => step.id === "menu")!;
    expect(menu.options).toContain("2ª Via Boleto (Rastreabem)");
    expect(menu.transitions?.["2ª Via Boleto (Rastreabem)"]).toBe("via-boleto");
    const compiled = compileChatbotFlow(JSON.stringify(next), [], current);
    expect(compiled).toBeDefined();
    expect(compiled!.draft.steps.map(step => step.id)).toEqual(["menu", "via-boleto", "rastreamento", "suporte"]);
    expect(compiled!.draft.steps.find(step => step.id === "suporte")?.config).toBe('{"targetMode":"QUEUE"}');
    expect(compiled!.draft.channelIds).toEqual(["draft"]);
  });

  it("envia um mapa compacto, sem configuração ou posições", () => {
    const outline = flowOutline(current);
    expect(outline).toContain("Menu principal");
    expect(outline).not.toContain("targetMode");
    expect(outline).not.toContain("position");
    expect(outline.length).toBeLessThan(2000);
  });

  it("recusa operações fora da whitelist", () => {
    expect(parseFlowPatch(JSON.stringify({ operations: [{ op: "deleteEverything" }] }))).toBeUndefined();
    expect(parseFlowPatch(JSON.stringify({ operations: Array.from({ length: 31 }, () => ({ op: "setName", value: "x" })) }))).toBeUndefined();
  });

  it("mantém a Skill curta e com o vocabulário do fluxo", () => {
    const skill = chatbotFlowDirectSkill("adjust", [{ key: "SUPORTE", name: "Suporte Técnico" }]);
    expect(skill).toContain("addBlock");
    expect(skill).toContain("connect");
    expect(skill).toContain("payment.status");
    expect(skill.length).toBeLessThan(3500);
  });
});
