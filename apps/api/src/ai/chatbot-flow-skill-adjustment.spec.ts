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

  it.each<[string, Record<string, string | number>, Record<string, string>]>([
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

describe("Formato tolerante das propostas da IA", () => {
  const departments = [{ key: "SUPORTE", name: "Suporte Técnico" }, { key: "ADM", name: "Administrativo" }];

  it("aceita preferred-name com uma transição e human.handoff sem saídas", () => {
    const proposal = JSON.stringify({
      flow: {
        name: "Atendimento com nome preferido",
        welcome: "Olá!",
        steps: [
          { id: "nome", kind: "preferred-name", options: ["Continuar"], transitions: { Continuar: "menu" } },
          { id: "menu", kind: "buttons", message: "{{novo_nome}}, qual área?", options: ["Suporte", "Administrativo"], transitions: { Suporte: "suporte", Administrativo: "administrativo" } },
          { id: "suporte", kind: "human.handoff", department: "Suporte Técnico" },
          { id: "administrativo", kind: "human.handoff", department: "Administrativo" },
        ],
      },
    });
    const compiled = compileChatbotFlow(proposal, departments);
    expect(compiled).toBeDefined();
    expect(compiled!.draft.steps.map(step => step.id)).toEqual(["nome", "nome-escolha", "nome-manter", "nome-digitar", "menu-triagem", "suporte", "administrativo"]);
    expect(compiled!.draft.steps.find(step => step.id === "nome-manter")?.transitions?.Continuar).toBe("menu-triagem");
    expect(compiled!.draft.steps.find(step => step.id === "suporte")).toMatchObject({ kind: "human.handoff", options: [] });
    expect(compiled!.draft.steps.find(step => step.id === "suporte")?.config).toBe('{"targetMode":"DEPARTMENT","departmentKey":"SUPORTE"}');
    expect(compiled!.warnings).toEqual([]);
  });

  it("normaliza aliases e destinos por título sem criar blocos novos", () => {
    const plan = {
      name: "Triagem",
      welcome: "Olá!",
      steps: [
        { id: "nome preferido", kind: "preferred_name", options: ["Usar nome identificado", "Digitar outro nome"], transitions: { "Usar nome identificado": "Menu de áreas", "Digitar outro nome": "Menu de áreas" } },
        { id: "menu", kind: "menu", title: "Menu de áreas", message: "Qual área?", options: ["Suporte", "Administrativo"], transitions: { Suporte: "Encaminhar Suporte", Administrativo: "adm" } },
        { id: "Encaminhar Suporte", kind: "human_handoff", department: { key: "SUPORTE", name: "Suporte Técnico" }, options: ["Continuar"], transitions: { Continuar: "adm" } },
        { id: "adm", kind: "human.handoff", department: "Administrativo" },
      ],
    };
    const proposal = "Segue o roteiro:\n```json\n" + JSON.stringify(plan) + "\n```";
    const compiled = compileChatbotFlow(proposal, departments);
    expect(compiled).toBeDefined();
    expect(compiled!.draft.steps[0]?.id).toBe("nome-preferido");
    expect(compiled!.draft.steps.find(step => step.id === "menu-triagem")?.transitions?.Suporte).toBe("encaminhar-suporte");
    expect(compiled!.draft.steps.find(step => step.id === "encaminhar-suporte")?.config).toBe('{"targetMode":"DEPARTMENT","departmentKey":"SUPORTE"}');
    expect(compiled!.warnings).toEqual([]);
  });
});
