import { GoogleAccessService } from "./google-access.service";
import { EventsService } from "./events.service";
import { PrismaService } from "../prisma/prisma.service";
import { PublicFlowController } from "./public-flow.controller";

function makeController(steps: object[], googleAccess?: GoogleAccessService) {
  const transaction = jest.fn().mockRejectedValue(new Error("temporarily unavailable"));
  const findMany = jest.fn().mockResolvedValue([{ accountId: "agenda-account", calendarId: "agenda-id" }]);
  const controller = new PublicFlowController({ $transaction: transaction, calendarAssignment: { findMany }, department: { findFirst: jest.fn().mockResolvedValue({ id: "support" }) } } as unknown as PrismaService, {} as EventsService, undefined, googleAccess);
  jest.spyOn(controller as unknown as { resolve: () => Promise<object> }, "resolve").mockResolvedValue({
    flow: { name: "Atendimento", steps },
    tenant: { id: "tenant", entitlements: { modules: ["CALENDAR"] } },
    calendarDepartmentId: "support",
    scopeKey: "default",
  });
  return { controller, transaction, findMany };
}

describe("Chatbot web channel", () => {
  it.each([
    ["payment.status", "pagamento_status"],
    ["calendar.availability", "agenda_disponivel"],
    ["calendar.book", "agenda_reserva"],
  ])("keeps the configured branch when %s is unavailable", async (kind, variable) => {
    const { controller, transaction } = makeController([
      { id: "integration", kind, options: ["Continuar"], transitions: { Continuar: "condition" } },
      { id: "condition", kind: "condition", config: JSON.stringify({ variable, value: "indisponível" }),
        options: ["Sim", "Não"], transitions: { Sim: "manual", Não: "confirmed" } },
      { id: "manual", kind: "text", message: "Vamos verificar por outro canal." },
      { id: "confirmed", kind: "text", message: "Confirmado." },
    ]);
    const result = await controller.message("a".repeat(48), {}, {});
    expect(result.messages).toEqual(["Vamos verificar por outro canal."]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("continues the waiting step, renders its option labels and follows the exact choice", async () => {
    const { controller } = makeController([
      { id: "channel", kind: "condition", config: '{"variable":"canal_atendimento","value":"web"}',
        options: ["Sim", "Não"], transitions: { Sim: "name", Não: "other-channel" } },
      { id: "other-channel", kind: "text", message: "Este é outro canal." },
      { id: "name", kind: "input.text", message: "Qual seu nome?", config: '{"variable":"nome"}',
        options: ["Continuar"], transitions: { Continuar: "menu" } },
      { id: "menu", kind: "buttons", message: "Qual setor?",
        options: ["Financeiro novo", "Financeiro", "Usar {{nome}}"],
        transitions: { "Financeiro novo": "new", Financeiro: "existing", "Usar {{nome}}": "custom" } },
      { id: "new", kind: "text", message: "Nova cobrança." },
      { id: "existing", kind: "text", message: "Cobrança existente." },
      { id: "custom", kind: "text", message: "Olá, {{nome}}." },
    ]);
    const token = "c".repeat(48);
    const initial = await controller.message(token, {}, {});
    expect(initial.messages).toEqual(["Qual seu nome?"]);
    const { sessionId } = initial;
    const menu = await controller.message(token, { sessionId, text: "Ana" }, {});
    expect(menu).toMatchObject({ options: ["Financeiro novo", "Financeiro", "Usar Ana"] });
    const ambiguous = await controller.message(token, { sessionId, text: "Finan" }, {});
    expect(ambiguous.finished).not.toBe(true);
    expect(ambiguous).toMatchObject({ options: ["Financeiro novo", "Financeiro", "Usar Ana"] });
    const answer = await controller.message(token, { sessionId, text: "Financeiro" }, {});
    expect(answer).toMatchObject({ messages: ["Cobrança existente."], finished: true });
  });

  it("uses the exact clicked exit even when two buttons render the same label", async () => {
    const { controller } = makeController([
      { id: "menu", kind: "buttons", message: "Qual opção?", options: ["Sim", "Sim{{vazio}}"],
        transitions: { Sim: "first", "Sim{{vazio}}": "second" } },
      { id: "first", kind: "text", message: "Primeira saída." },
      { id: "second", kind: "text", message: "Segunda saída." },
    ]);
    const token = "d".repeat(48);
    const { sessionId } = await controller.message(token, {}, {});
    const stale = await controller.message(token, { sessionId, text: "Sim", choice: { stepId: "previous", index: 1 } }, {});
    expect(stale).toMatchObject({ choiceStepId: "menu", options: ["Sim", "Sim"] });
    const answer = await controller.message(token, { sessionId, text: "Sim", choice: { stepId: "menu", index: 1 } }, {});
    expect(answer).toMatchObject({ messages: ["Segunda saída."], finished: true });
  });

  it("queries only the published department calendar and uses availability in the web flow", async () => {
    const token = jest.fn().mockResolvedValue("test-access");
    const provider = jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ calendars: { "agenda-id": { busy: [] } } }));
    try {
      const start = new Date(Date.now() + 86_400_000).toISOString();
      const { controller, findMany } = makeController([
        { id: "availability", kind: "calendar.availability", config: JSON.stringify({ start, minutes: "30" }),
          options: ["Continuar"], transitions: { Continuar: "condition" } },
        { id: "condition", kind: "condition", config: '{"variable":"agenda_disponivel","value":"sim"}',
          options: ["Sim", "Não"], transitions: { Sim: "free", Não: "fallback" } },
        { id: "free", kind: "text", message: "Horário livre." },
        { id: "fallback", kind: "text", message: "Não consegui confirmar." },
      ], { token } as unknown as GoogleAccessService);
      const answer = await controller.message("e".repeat(48), {}, {});
      expect(answer.messages).toEqual(["Horário livre."]);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant", departmentId: "support" } }));
      expect(token).toHaveBeenCalledWith("tenant", "agenda-account", "calendar");
      expect(provider).toHaveBeenCalledTimes(1);
    } finally {
      provider.mockRestore();
    }
  });

  it("waits for explicit web confirmation before booking the department calendar", async () => {
    const access = { token: jest.fn().mockResolvedValue("test-access") } as unknown as GoogleAccessService;
    const provider = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ calendars: { "agenda-id": { busy: [] } } }))
      .mockImplementationOnce(async (_url, init) => {
        const event = JSON.parse(String(init?.body));
        expect(event.summary).toBe("Consulta");
        return Response.json({ id: event.id, status: "confirmed" });
      });
    try {
      const start = new Date(Date.now() + 86_400_000).toISOString();
      const { controller, transaction } = makeController([
        { id: "book", kind: "calendar.book", config: JSON.stringify({ start, minutes: "30", title: "Consulta" }),
          options: ["Continuar"], transitions: { Continuar: "result" } },
        { id: "result", kind: "condition", config: '{"variable":"agenda_reserva","value":"confirmado"}',
          options: ["Sim", "Não"], transitions: { Sim: "success", Não: "fallback" } },
        { id: "success", kind: "text", message: "Reserva confirmada." },
        { id: "fallback", kind: "text", message: "Reserva não confirmada." },
      ], access);
      transaction.mockImplementation(async run => run({ $queryRaw: jest.fn() }));
      const token = "f".repeat(48);
      const prompt = await controller.message(token, {}, {});
      expect(prompt).toMatchObject({ options: ["Confirmar horário", "Voltar"], choiceStepId: "book" });
      expect(provider).not.toHaveBeenCalled();
      const answer = await controller.message(token, { sessionId: prompt.sessionId, text: "Confirmar horário", choice: { stepId: "book", index: 0 } }, {});
      expect(answer.messages).toEqual(["Reserva confirmada."]);
      expect(provider).toHaveBeenCalledTimes(3);
    } finally {
      provider.mockRestore();
    }
  });

  it("keeps the conversation open when the handoff fails", async () => {
    const { controller, transaction } = makeController([{ id: "handoff", kind: "human.handoff" }]);
    const result = await controller.message("b".repeat(48), {}, {});
    expect(result.finished).not.toBe(true);
    expect(result.handoff).not.toBe(true);
    await controller.message("b".repeat(48), { sessionId: result.sessionId, text: "Tentar novamente" }, {});
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
