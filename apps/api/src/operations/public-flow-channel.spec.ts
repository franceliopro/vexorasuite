import { EventsService } from "./events.service";
import { PrismaService } from "../prisma/prisma.service";
import { PublicFlowController } from "./public-flow.controller";

function makeController(steps: object[]) {
  const transaction = jest.fn().mockRejectedValue(new Error("temporarily unavailable"));
  const controller = new PublicFlowController({ $transaction: transaction } as unknown as PrismaService, {} as EventsService);
  jest.spyOn(controller as unknown as { resolve: () => Promise<object> }, "resolve").mockResolvedValue({
    flow: { name: "Atendimento", steps },
    tenant: { id: "tenant" },
    scopeKey: "default",
  });
  return { controller, transaction };
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
    const { sessionId } = await controller.message(token, {}, {});
    const menu = await controller.message(token, { sessionId, text: "Ana" }, {});
    expect(menu).toMatchObject({ options: ["Financeiro novo", "Financeiro", "Usar Ana"] });
    const ambiguous = await controller.message(token, { sessionId, text: "Finan" }, {});
    expect(ambiguous.finished).not.toBe(true);
    expect(ambiguous).toMatchObject({ options: ["Financeiro novo", "Financeiro", "Usar Ana"] });
    const answer = await controller.message(token, { sessionId, text: "Financeiro" }, {});
    expect(answer).toMatchObject({ messages: ["Cobrança existente."], finished: true });
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
