import { MailService } from "./mail.service";
import { MailTransport } from "./mail.types";

const ORIGINAL = { ...process.env };
const reset = () => {
  for (const key of ["MAIL_TRANSPORT", "MAIL_HOST", "MAIL_PORT", "MAIL_SECURE", "MAIL_USER", "MAIL_PASSWORD", "MAIL_FROM", "MAIL_FROM_NAME"]) {
    delete process.env[key];
  }
};

const fake = (result: any): MailTransport => ({ kind: "smtp", send: jest.fn().mockResolvedValue(result) });

describe("MailService", () => {
  beforeEach(reset);
  afterAll(() => {
    process.env = { ...ORIGINAL };
  });

  it("falls back to the log transport when SMTP is not configured, and says so", async () => {
    const service = new MailService();
    expect(service.status()).toMatchObject({ transport: "log", configured: false });
    const result = await service.send({ to: "destino@exemplo.com", subject: "Oi", text: "Corpo" });
    expect(result).toMatchObject({ delivered: false, transport: "log" });
    expect(result.reason).toContain("SMTP não configurado");
  });

  it("selects SMTP when host and sender are present", () => {
    process.env.MAIL_TRANSPORT = "smtp";
    process.env.MAIL_HOST = "smtp.exemplo.com";
    process.env.MAIL_FROM = "nao-responda@vexorasuite.com.br";
    const service = new MailService();
    expect(service.status()).toMatchObject({
      transport: "smtp",
      configured: true,
      from: "nao-responda@vexorasuite.com.br",
      host: "smtp.exemplo.com",
    });
  });

  it("does not pretend SMTP works when the host is missing", () => {
    process.env.MAIL_TRANSPORT = "smtp";
    process.env.MAIL_FROM = "nao-responda@vexorasuite.com.br";
    expect(new MailService().status().transport).toBe("log");
  });

  it("honours an explicit shutdown of mail", async () => {
    process.env.MAIL_TRANSPORT = "off";
    const service = new MailService();
    expect(service.status().transport).toBe("off");
    await expect(service.send({ to: "a@b.com", subject: "x", text: "y" })).resolves.toMatchObject({
      delivered: false,
      transport: "off",
    });
    await expect(service.verify()).resolves.toMatchObject({ ok: false });
  });

  it("rejects an invalid recipient without calling the transport", async () => {
    const transport = fake({ delivered: true, transport: "smtp" });
    const service = new MailService(transport);
    const result = await service.send({ to: "sem-arroba", subject: "x", text: "y" });
    expect(result.delivered).toBe(false);
    expect(result.reason).toBe("Destinatário inválido.");
    expect(transport.send).not.toHaveBeenCalled();
  });

  it("relays the transport result", async () => {
    const transport = fake({ delivered: true, transport: "smtp", providerId: "<id>" });
    const service = new MailService(transport);
    await expect(service.send({ to: "a@b.com", subject: "x", text: "y" })).resolves.toMatchObject({
      delivered: true,
      providerId: "<id>",
    });
  });
});
