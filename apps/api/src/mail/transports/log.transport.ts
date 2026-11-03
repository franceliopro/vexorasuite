import { Logger } from "@nestjs/common";
import { MailMessage, MailResult, MailTransport } from "../mail.types";

/**
 * Development / misconfigured fallback.
 *
 * It writes the message to the log so the link can be copied by hand and reports `delivered: false`
 * on purpose: nothing left the process. Using it in production is a configuration mistake, not a
 * silent success.
 */
export class LogMailTransport implements MailTransport {
  readonly kind = "log" as const;
  private readonly logger = new Logger(LogMailTransport.name);

  async send(message: MailMessage): Promise<MailResult> {
    this.logger.log(
      `E-mail não enviado (SMTP não configurado). Para: ${message.to} | Assunto: ${message.subject}\n${message.text}`,
    );
    return { delivered: false, transport: "log", reason: "SMTP não configurado; mensagem apenas registrada no log." };
  }
}
