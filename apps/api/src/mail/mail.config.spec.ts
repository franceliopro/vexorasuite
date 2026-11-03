import { mailProblem, maskAddress, resolveMailSettings } from "./mail.config";

const GMAIL = {
  MAIL_USER: "vexorasuite@gmail.com",
  MAIL_PASSWORD: "abcd efgh ijkl mnop",
};

describe("resolveMailSettings", () => {
  it("stays off with a clear reason when nothing is configured", () => {
    const settings = resolveMailSettings({});
    expect(settings.mode).toBe("log");
    expect(settings.missing).toEqual(["MAIL_HOST", "MAIL_FROM"]);
    expect(mailProblem(settings)).toContain("MAIL_HOST");
  });

  it("recognises Gmail from the user and applies the provider rules", () => {
    const settings = resolveMailSettings(GMAIL);
    expect(settings.mode).toBe("smtp");
    expect(settings.service).toBe("gmail");
    expect(settings.host).toBe("smtp.gmail.com");
    expect(settings.port).toBe(465);
    expect(settings.secure).toBe(true);
    // Gmail rewrites the sender to the authenticated account, so this is the only valid From.
    expect(settings.from).toBe("vexorasuite@gmail.com");
    // Google shows app passwords with spaces; sending them with spaces fails authentication.
    expect(settings.password).toBe("abcdefghijklmnop");
    expect(settings.warnings.join(" ")).toContain("Espaços removidos");
    expect(settings.missing).toEqual([]);
  });

  it("uses an explicit host and port over the provider default", () => {
    const settings = resolveMailSettings({
      ...GMAIL,
      MAIL_SERVICE: "gmail",
      MAIL_HOST: "smtp.gmail.com",
      MAIL_PORT: "587",
    });
    expect(settings.port).toBe(587);
    expect(settings.secure).toBe(false);
  });

  it("accepts a variable created with a different name and names the canonical one", () => {
    const settings = resolveMailSettings({
      SMTP_HOST: "smtp.zoho.com",
      SMTP_PORT: "465",
      SMTP_USER: "nao-responda@vexorasuite.com.br",
      SMTP_PASSWORD: "segredo",
      SMTP_FROM: "nao-responda@vexorasuite.com.br",
    });
    expect(settings.mode).toBe("smtp");
    expect(settings.host).toBe("smtp.zoho.com");
    expect(settings.sources.host).toBe("SMTP_HOST");
    expect(settings.warnings).toContain("MAIL_HOST não está definida; o valor veio de SMTP_HOST. Use MAIL_HOST.");
  });

  it("keeps the canonical variable when both names exist", () => {
    const settings = resolveMailSettings({ MAIL_HOST: "smtp.a.com", SMTP_HOST: "smtp.b.com", MAIL_FROM: "a@a.com" });
    expect(settings.host).toBe("smtp.a.com");
    expect(settings.sources.host).toBe("MAIL_HOST");
  });

  it("does not call itself configured when the password is missing", () => {
    const settings = resolveMailSettings({ MAIL_USER: "vexorasuite@gmail.com" });
    expect(settings.mode).toBe("log");
    expect(settings.missing).toContain("MAIL_PASSWORD");
  });

  it("warns when a custom sender is used with Gmail", () => {
    const settings = resolveMailSettings({ ...GMAIL, MAIL_FROM: "contato@vexorasuite.com.br" });
    expect(settings.from).toBe("contato@vexorasuite.com.br");
    expect(settings.warnings.join(" ")).toContain("remetente é reescrito");
  });

  it("honours an explicit shutdown", () => {
    expect(resolveMailSettings({ ...GMAIL, MAIL_TRANSPORT: "off" }).mode).toBe("off");
  });

  it("honours MAIL_TRANSPORT=log even with valid credentials", () => {
    expect(resolveMailSettings({ ...GMAIL, MAIL_TRANSPORT: "log" }).mode).toBe("log");
  });

  it("tells a variable that is absent from one that exists but is empty", () => {
    // This is what a Dokploy variable created in the wrong scope looks like: defined, but blank.
    const settings = resolveMailSettings({
      MAIL_HOST: "",
      MAIL_USER: "nao-responda@vexorasuite.com.br",
      MAIL_PASSWORD: "segredo",
    });
    expect(settings.mode).toBe("log");
    expect(settings.missing).toEqual(["MAIL_HOST"]);
    expect(settings.blank).toEqual(["MAIL_HOST"]);
    expect(mailProblem(settings)).toContain("existe(m) no ambiente mas vazio(s)");
  });

  it("does not complain about a blank variable that a preset already covers", () => {
    const settings = resolveMailSettings({ ...GMAIL, MAIL_HOST: "", MAIL_FROM: "" });
    expect(settings.mode).toBe("smtp");
    expect(settings.blank).toEqual([]);
  });

  it("flags TLS disabled on the implicit TLS port", () => {
    const settings = resolveMailSettings({ ...GMAIL, MAIL_PORT: "465", MAIL_SECURE: "false" });
    expect(settings.secure).toBe(false);
    expect(settings.warnings.join(" ")).toContain("MAIL_SECURE=false com porta 465");
  });
});

describe("maskAddress", () => {
  it("keeps the domain and hides the mailbox", () => {
    expect(maskAddress("vexorasuite@gmail.com")).toBe("ve*********@gmail.com");
    expect(maskAddress(undefined)).toBeUndefined();
  });
});
