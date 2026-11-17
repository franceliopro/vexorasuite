import { teamPasswordMessage } from "./team-password-message";
import { PASSWORD_SYMBOLS } from "../auth/password-policy";

describe("team access email", () => {
  const input = { name: "Fran & <Equipe>", company: "rastreabem", email: "atendente@example.test", password: "Vx!temp123", reason: "create" as const };

  it("provides the login information and actual password rules in both formats", () => {
    const mail = teamPasswordMessage(input);
    expect(mail.to).toBe(input.email);
    expect(mail.text).toContain("Olá, Fran & <Equipe>!");
    for (const value of [input.company, input.email, input.password, "https://app.vexorasuite.com.br", "8 a 128 caracteres"]) {
      expect(mail.text).toContain(value);
      expect(mail.html).toContain(value);
    }
    expect(mail.text).toContain(PASSWORD_SYMBOLS);
    expect(mail.html).toContain("Fran &amp; &lt;Equipe&gt;");
    expect(mail.html).not.toContain("<Equipe>");
  });

  it("uses the reset subject and instructions for a new temporary password", () => {
    const mail = teamPasswordMessage({ ...input, reason: "reset" });
    expect(mail.subject).toBe("Sua nova senha temporária");
    expect(mail.text).toContain("Sua senha foi redefinida");
  });
});
