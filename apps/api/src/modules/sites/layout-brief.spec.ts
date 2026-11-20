import { parseLayoutBrief } from "./layout-brief";

describe("interpretação da imagem de layout", () => {
  it("aceita JSON cerca de código e normaliza seções em português", () => {
    const raw = [
      "```json",
      JSON.stringify({
        sections: ["Hero", "serviços", "serviços", "depoimentos", "contato", "inexistente"],
        emphasis: "Serviços",
        density: "Generosa",
        confidence: 1.8,
        notes: "Muitos <script> cards na dobra inicial",
      }),
      "```",
    ].join("\n");
    const brief = parseLayoutBrief(raw, "gpt-5");

    expect(brief).toMatchObject({
      sections: ["hero", "servicos", "depoimentos", "contato"],
      emphasis: "servicos",
      density: "generosa",
      confidence: 1,
      model: "gpt-5",
    });
    expect(brief?.notes).not.toContain("<script>");
  });

  it("usa padrões seguros quando a resposta é incompleta", () => {
    const brief = parseLayoutBrief(JSON.stringify({ sections: ["hero", "sobre"], emphasis: "inexistente", density: "outra", confidence: "x" }));
    expect(brief).toMatchObject({ emphasis: "hero", density: "equilibrada", confidence: 0.5 });
    expect(brief?.model).toBeUndefined();
  });

  it("rejeita resposta sem pelo menos duas seções reconhecidas", () => {
    expect(parseLayoutBrief("não é json")).toBeNull();
    expect(parseLayoutBrief(JSON.stringify({ sections: ["hero", "inventado"] }))).toBeNull();
  });
});
