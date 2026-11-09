import { explainSmtpError } from "./mail.diagnostics";

describe("explainSmtpError", () => {
  it("turns the Gmail authentication failure into the app-password instruction", () => {
    const hint = explainSmtpError(
      "Invalid login: 535-5.7.8 Username and Password not accepted. For more information, go to 535 5.7.8 https://support.google.com/mail/?p=BadCredentials",
    );
    expect(hint).toContain("senha de app");
    expect(hint).toContain("Gmail");
  });

  it("explains the rejected sender, which is the other Gmail wall", () => {
    const hint = explainSmtpError("550-5.7.1 From address not owned by user");
    expect(hint).toContain("MAIL_FROM");
    expect(hint).toContain("MAIL_USER");
  });

  it("maps connection, TLS and quota failures", () => {
    expect(explainSmtpError("Connection timeout")).toContain("465");
    expect(explainSmtpError("error: self-signed certificate in certificate chain")).toContain("MAIL_SECURE");
    expect(explainSmtpError("Daily user sending limit exceeded")).toMatch(/cota/i);
  });

  it("stays quiet when it does not recognise the failure", () => {
    expect(explainSmtpError("algo totalmente novo")).toBeUndefined();
    expect(explainSmtpError(undefined)).toBeUndefined();
  });
});
