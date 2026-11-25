import { allowedModulesOf, hasPlansAccess, preservePlansAccess, withPlansAccess } from "./entitlements";
import { MODULES, routeModules } from "./module-policy";

describe("Planos e preços como capacidade controlada pela plataforma", () => {
  it("não aparece para clientes sem liberação explícita", () => {
    expect(MODULES).toContain("PLANS");
    expect(allowedModulesOf("CLIENT", {})).not.toContain("PLANS");
    expect(allowedModulesOf("CLIENT", { modules: ["INBOX", "SETTINGS"] })).not.toContain("PLANS");
    expect(allowedModulesOf("PLATFORM", {})).not.toContain("PLANS");
  });

  it("entra apenas quando a administração libera para o tenant", () => {
    expect(allowedModulesOf("CLIENT", { modules: ["INBOX", "PLANS"] })).toContain("PLANS");
    expect(hasPlansAccess({ modules: ["PLANS"] })).toBe(true);
    expect(withPlansAccess({}, true).modules).toEqual(expect.arrayContaining(["PLANS", "SETTINGS"]));
    expect(withPlansAccess({ modules: ["INBOX", "PLANS"], bots: 2 }, false)).toEqual({
      modules: ["INBOX", "SETTINGS"],
      bots: 2,
    });
  });

  it("preserva a liberação quando um plano é reatribuído", () => {
    const next = { modules: ["INBOX", "SETTINGS"], finance: true };
    expect(preservePlansAccess({ modules: ["INBOX", "PLANS"] }, next).modules).toEqual(
      expect.arrayContaining(["INBOX", "SETTINGS", "PLANS"]),
    );
    expect(preservePlansAccess({ modules: ["INBOX"] }, next).modules).not.toContain("PLANS");
  });

  it("protege as rotas diretas de planos e cobrança", () => {
    expect(routeModules("/api/plans", "GET")).toEqual(["PLANS"]);
    expect(routeModules("/api/billing/activate", "POST")).toEqual(["PLANS"]);
    expect(routeModules("/api/auth/me", "GET")).toEqual([]);
  });
});
