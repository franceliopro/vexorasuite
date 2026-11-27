import {
  ATTENDANCE_STATUSES,
  attendanceStats,
  balanceOf,
  classTime,
  cleanRichText,
  httpsUrl,
  inList,
  integer,
  isUuid,
  isoDate,
  optionalInteger,
  text,
  youtubeEmbed,
} from "./school-rules";

describe("Gestão escolar — regras determinísticas", () => {
  it("consome aula em presença, falta justificada e reposição; cancelamento gera pendência", () => {
    expect(balanceOf(8, 2, ["PRESENT", "ABSENT", "JUSTIFIED"])).toEqual({
      contracted: 10,
      consumed: 3,
      balance: 7,
      pendingMakeups: 0,
    });
    expect(balanceOf(4, 0, ["ABSENT", "CANCELLED"])).toEqual({
      contracted: 4,
      consumed: 1,
      balance: 3,
      pendingMakeups: 1,
    });
    expect(balanceOf(6, 0, ["CANCELLED", "MAKEUP"])).toEqual({
      contracted: 6,
      consumed: 1,
      balance: 5,
      pendingMakeups: 0,
    });
    expect(balanceOf(2, 0, ["MAKEUP", "MAKEUP", "CANCELLED"]).balance).toBe(0);
  });

  it("calcula porcentagem de presença e falta separadamente para alunos e professores", () => {
    const stats = attendanceStats([
      { sessionId: "s1", personKind: "STUDENT", personId: "a", status: "PRESENT" },
      { sessionId: "s2", personKind: "STUDENT", personId: "a", status: "ABSENT" },
      { sessionId: "s3", personKind: "STUDENT", personId: "a", status: "ABSENT" },
      { sessionId: "s1", personKind: "TEACHER", personId: "t", status: "PRESENT" },
      { sessionId: "s2", personKind: "TEACHER", personId: "t", status: "PRESENT" },
    ]);
    expect(stats.students).toMatchObject({ sessions: 3, present: 1, absences: 2, percentage: 33 });
    expect(stats.teachers).toMatchObject({ sessions: 2, present: 2, absences: 0, percentage: 100 });
  });

  it("valida entradas sem aceitar valores ambíguos", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("turma-1")).toBe(false);
    expect(classTime("18:30")).toBe("18:30");
    expect(() => classTime("25:00")).toThrow("HH:mm");
    expect(integer("7", 1, 7, "Dia da semana")).toBe(7);
    expect(() => integer(0, 1, 7, "Dia da semana")).toThrow("inteiro entre 1 e 7");
    expect(optionalInteger("", 0, 10, "Valor")).toBeNull();
    expect(isoDate("2026-02-30")).toBeNull();
    expect(isoDate("2026-11-27")).toBe("2026-11-27");
    expect(text("  Piano  ", 80, "Nome")).toBe("Piano");
    expect(httpsUrl("http://inseguro.example.com", "URL")).toThrow("HTTPS");
    expect(() => inList("PAID", ATTENDANCE_STATUSES, "Status")).toThrow("inválido");
  });

  it("aceita apenas vídeos do YouTube e devolve embed nocookie", () => {
    expect(youtubeEmbed("https://www.youtube.com/watch?v=abc123DEF")).toBe(
      "https://www.youtube-nocookie.com/embed/abc123DEF?rel=0",
    );
    expect(youtubeEmbed("https://youtu.be/abc123DEF")).toBe("https://www.youtube-nocookie.com/embed/abc123DEF?rel=0");
    expect(youtubeEmbed("https://www.youtube.com/embed/abc123DEF")).toBe("https://www.youtube-nocookie.com/embed/abc123DEF?rel=0");
    expect(youtubeEmbed("https://evil.example.com/embed/abc123DEF")).toBeNull();
    expect(youtubeEmbed("javascript:alert(1)")).toBeNull();
  });

  it("sanitiza richtext e transforma somente iframes do YouTube em embed", () => {
    const clean = cleanRichText(
      '<h2>Objetivo</h2><p>Estudar escalas</p><iframe src="https://www.youtube.com/embed/abc123DEF"></iframe><iframe src="https://evil.example.com"></iframe><script>alert(1)</script>',
      "Objetivo",
    );
    expect(clean).toContain("Estudar escalas");
    expect(clean).toContain("youtube-nocookie.com/embed/abc123DEF");
    expect(clean).not.toContain("evil.example.com");
    expect(clean).not.toContain("<script");
    expect(() => cleanRichText("x".repeat(60001), "Objetivo")).toThrow("60000");
  });
});
