import { ASSISTANT_SPECIALISTS, SPECIALIST_AGENT_IDS, isBuiltInSpecialist } from "./assistant-specialists";
import { productSkills } from "./product-skills";
import { AssistantController } from "./assistant.controller";

describe("assistentes especialistas e skills úteis", () => {
  it("cobre as demandas reais com perfis distintos e sem atendimento automático", () => {
    const modules = ASSISTANT_SPECIALISTS.map(agent => agent.bindings.modules[0]);
    expect(modules).toEqual(["FINANCE", "CRM", "INBOX", "TASKS", "AUTOMATION"]);
    for (const agent of ASSISTANT_SPECIALISTS) {
      expect(agent.enabled).toBe(true);
      expect(agent.bindings.mode).toBe("specialist");
      expect(agent.bindings.inboxes).toEqual([]);
      expect(agent.allowedActions).toContain("assistant.direct.context");
      expect(agent.behavior.rules).toContain("Responda primeiro com o dado pedido");
    }
    expect(isBuiltInSpecialist(SPECIALIST_AGENT_IDS[0])).toBe(true);
    expect(isBuiltInSpecialist("agente-customizado")).toBe(false);
  });

  it("remove skills que prometem operações não implementadas do catálogo", () => {
    const catalog = new AssistantController({} as any, {} as any, {} as any, {} as any).skills().skills;
    expect(catalog.some((skill: any) => skill.implemented === false)).toBe(false);
    expect(catalog.some((skill: any) => skill.id === "chatbot.flow.direct")).toBe(true);
    expect(catalog.some((skill: any) => skill.id === "assistant.direct.context")).toBe(true);
    expect(productSkills.some(skill => skill.id === "assistant.direct.context")).toBe(true);
  });
});
