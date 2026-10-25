import { advanceRastreabemBot, startRastreabemBot } from "./rastreabem-bot";
describe("Rastreabem bot policy", () => {
  const protocol = "RB-20261025-000001";
  it("greets verified customers without redundant questions", () => {
    const result = startRastreabemBot({ protocol, verifiedCustomerName: "Maria" });
    expect(result.state.novo_nome).toBe("Maria");
    expect(result.state.step).toBe("SECTOR");
    expect(result.messages.join(" ")).toContain(protocol);
  });
  it("confirms a suggested name as novo_nome", () => {
    const start = startRastreabemBot({ protocol, suggestedName: "Ana" });
    const result = advanceRastreabemBot(start.state, "sim", "Ana");
    expect(result.state.novo_nome).toBe("Ana");
  });
  it.each(["1", "2", "3"])("requires platform before financial choice, platform %s", selection => {
    let result = startRastreabemBot({ protocol, verifiedCustomerName: "João" });
    result = advanceRastreabemBot(result.state, "1");
    expect(result.state.step).toBe("PLATFORM");
    result = advanceRastreabemBot(result.state, selection);
    expect(result.state.step).toBe("FINANCE_CHOICE");
    expect(result.messages.join(" ")).toContain("Asaas");
    expect(result.messages.join(" ")).toContain("atendente");
  });
  it("routes support by platform", () => {
    let result = startRastreabemBot({ protocol, verifiedCustomerName: "João" });
    result = advanceRastreabemBot(result.state, "2");
    result = advanceRastreabemBot(result.state, "Ceeb Vision");
    expect(result.effects).toEqual([{ type: "TRANSFER", sector: "SUPORTE", platform: "Ceeb Vision" }]);
  });
  it("requests a document before financial lookup", () => {
    let result = startRastreabemBot({ protocol, verifiedCustomerName: "João" });
    for (const input of ["Financeiro", "Link", "2"]) result = advanceRastreabemBot(result.state, input);
    expect(result.state.step).toBe("DOCUMENT");
    result = advanceRastreabemBot(result.state, "123");
    expect(result.effects).toHaveLength(0);
    result = advanceRastreabemBot(result.state, "12345678901");
    expect(result.effects[0]).toEqual({ type: "ASAAS_LOOKUP", document: "12345678901", platform: "Link" });
  });
});
