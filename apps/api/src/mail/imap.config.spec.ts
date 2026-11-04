import { resolveImapSettings } from "./imap.config";

describe("resolveImapSettings", () => {
  it("derives Gmail IMAP settings from the mailbox account", () => {
    const settings = resolveImapSettings({
      MAIL_USER: "franceliopro@gmail.com",
      MAIL_PASSWORD: "abcd efgh ijkl mnop",
    });
    expect(settings.mode).toBe("imap");
    expect(settings.service).toBe("gmail");
    expect(settings.host).toBe("imap.gmail.com");
    expect(settings.port).toBe(993);
    expect(settings.secure).toBe(true);
    expect(settings.password).toBe("abcdefghijklmnop");
    expect(settings.mailbox).toBe("INBOX");
  });

  it("does not enable IMAP with placeholders or missing credentials", () => {
    const settings = resolveImapSettings({
      MAIL_IMAP_HOST: "imap.example.com",
      MAIL_IMAP_USER: "<usuario>",
      MAIL_IMAP_PASSWORD: "<senha de app>",
    });
    expect(settings.mode).toBe("off");
    expect(settings.missing).toEqual(expect.arrayContaining(["MAIL_IMAP_USER", "MAIL_IMAP_PASSWORD"]));
    expect(settings.warnings.join(" ")).toMatch(/texto de exemplo/i);
  });

  it("accepts an explicit host with port and mailbox", () => {
    const settings = resolveImapSettings({
      MAIL_IMAP_HOST: "imaps://mail.example.com:993/",
      MAIL_IMAP_PORT: "",
      MAIL_IMAP_USER: "inbox@example.com",
      MAIL_IMAP_PASSWORD: "secret",
      MAIL_IMAP_MAILBOX: "Support",
    });
    expect(settings.mode).toBe("imap");
    expect(settings.host).toBe("mail.example.com");
    expect(settings.port).toBe(993);
    expect(settings.mailbox).toBe("Support");
  });
});
