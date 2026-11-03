jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

import { createTransport } from "nodemailer";
import { SmtpMailTransport } from "./smtp.transport";

const createTransportMock = createTransport as unknown as jest.Mock;

const build = () =>
  new SmtpMailTransport({
    host: "smtp.exemplo.com",
    port: 587,
    secure: false,
    user: "usuario",
    password: "segredo",
    from: "nao-responda@vexorasuite.com.br",
    fromName: "Véxora Suite",
  });

describe("SmtpMailTransport", () => {
  const sendMail = jest.fn();
  const verify = jest.fn();
  const close = jest.fn();

  beforeEach(() => {
    sendMail.mockReset();
    verify.mockReset();
    close.mockReset();
    createTransportMock.mockReset();
    createTransportMock.mockReturnValue({ sendMail, verify, close });
  });

  it("reports delivery only when the server accepts the recipient", async () => {
    sendMail.mockResolvedValue({ accepted: ["destino@exemplo.com"], messageId: "<id@vexora>" });
    const result = await build().send({ to: "destino@exemplo.com", subject: "Oi", text: "Corpo" });
    expect(result).toMatchObject({ delivered: true, transport: "smtp", providerId: "<id@vexora>" });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"Véxora Suite" <nao-responda@vexorasuite.com.br>', to: "destino@exemplo.com" }),
    );
  });

  it("does not claim delivery when the server refuses the recipient", async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: ["destino@exemplo.com"] });
    const result = await build().send({ to: "destino@exemplo.com", subject: "Oi", text: "Corpo" });
    expect(result.delivered).toBe(false);
    expect(result.reason).toContain("não aceitou");
  });

  it("returns the transport error instead of throwing", async () => {
    sendMail.mockRejectedValue(new Error("Connection timeout"));
    const result = await build().send({ to: "destino@exemplo.com", subject: "Oi", text: "Corpo" });
    expect(result).toMatchObject({ delivered: false, reason: "Connection timeout" });
  });

  it("exposes a real connection check", async () => {
    verify.mockResolvedValue(true);
    await expect(build().verify()).resolves.toEqual({ ok: true });
    verify.mockRejectedValue(new Error("EAUTH"));
    await expect(build().verify()).resolves.toEqual({ ok: false, detail: "EAUTH" });
  });

  it("never puts the password in the message envelope", async () => {
    sendMail.mockResolvedValue({ accepted: ["a@b.com"] });
    await build().send({ to: "a@b.com", subject: "Oi", text: "Corpo" });
    expect(JSON.stringify(sendMail.mock.calls[0][0])).not.toContain("segredo");
  });
});
