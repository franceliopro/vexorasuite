import { balanceOf, integer, isUuid, isoDate, optionalInteger, OUTCOMES, text } from "./music-school-rules";

describe("Escola de Música — regras determinísticas", () => {
  it("consome aula em ATTENDED, STUDENT_ABSENT e MAKEUP; gera reposição em TEACHER_ABSENT e CANCELLED", () => {
    expect(balanceOf(8, 2, ["ATTENDED", "STUDENT_ABSENT", "ATTENDED"])).toEqual({
      contracted: 10,
      consumed: 3,
      balance: 7,
      pendingMakeups: 0,
    });
    expect(balanceOf(4, 0, ["TEACHER_ABSENT", "CANCELLED"])).toEqual({
      contracted: 4,
      consumed: 0,
      balance: 4,
      pendingMakeups: 2,
    });
    expect(balanceOf(6, 0, ["TEACHER_ABSENT", "CANCELLED", "MAKEUP"])).toEqual({
      contracted: 6,
      consumed: 1,
      balance: 5,
      pendingMakeups: 1,
    });
    expect(balanceOf(2, 0, ["MAKEUP", "MAKEUP", "TEACHER_ABSENT"])).toEqual({
      contracted: 2,
      consumed: 2,
      balance: 0,
      pendingMakeups: 0,
    });
  });

  it("nunca produz saldo negativo e mantém os cinco estados honestos", () => {
    const totals = balanceOf(1, 0, OUTCOMES);
    expect(totals.consumed).toBe(3);
    expect(totals.balance).toBe(0);
    expect(totals.pendingMakeups).toBe(1);
  });

  it("valida identificadores, inteiros e datas sem aceitar valores ambíguos", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("turma-1")).toBe(false);
    expect(integer("7", 1, 7, "Dia da semana")).toBe(7);
    expect(() => integer(0, 1, 7, "Dia da semana")).toThrow("inteiro entre 1 e 7");
    expect(optionalInteger("", 0, 10, "Valor")).toBeNull();
    expect(isoDate("2026-02-30")).toBeNull();
    expect(isoDate("2026-11-27")).toBe("2026-11-27");
    expect(text("  Piano  ", 40)).toBe("Piano");
    expect(text("x".repeat(100), 40)).toHaveLength(40);
  });
});
