import { MailMessage, MailResult, MailTransport } from "../mail.types";

/** Explicitly disabled mail (MAIL_TRANSPORT=off). */
export class OffMailTransport implements MailTransport {
  readonly kind = "off" as const;

  async send(_message: MailMessage): Promise<MailResult> {
    return { delivered: false, transport: "off", reason: "Envio de e-mail desativado neste ambiente." };
  }
}
