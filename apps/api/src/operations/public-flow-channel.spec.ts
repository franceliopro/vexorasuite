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

  it("keeps the conversation open when the handoff fails", async () => {
    const { controller, transaction } = makeController([{ id: "handoff", kind: "human.handoff" }]);
    const result = await controller.message("b".repeat(48), {}, {});
    expect(result.finished).not.toBe(true);
    expect(result.handoff).not.toBe(true);
    await controller.message("b".repeat(48), { sessionId: result.sessionId, text: "Tentar novamente" }, {});
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
