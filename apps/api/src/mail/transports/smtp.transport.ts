import { Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { MailMessage, MailResult, MailTransport } from "../mail.types";
import { explainSmtpError } from "../mail.diagnostics";

export interface SmtpConfig {
  /** Provider preset understood by nodemailer (gmail, zoho, titan, ...). Host/port still apply. */
  service?: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  accessToken?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  /** Original hostname used for TLS SNI when host is pinned to a resolved public IP. */
  tlsServername?: string;
}

/**
 * SMTP delivery through nodemailer.
 *
 * SMTP was chosen over a provider SDK because it works with every provider the business may use
 * (Zoho, Titan, SES, Resend, Postmark, Gmail) and keeps the credentials in the environment instead
 * of in the code. `delivered` is only true when the server accepts the recipient.
 */
export class SmtpMailTransport implements MailTransport {
  readonly kind = "smtp" as const;
  private readonly logger = new Logger(SmtpMailTransport.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = createTransport({
      ...(config.service ? { service: config.service } : {}),
      host: config.host,
      ...(config.tlsServername ? { tls: { servername: config.tlsServername } } : {}),
      port: config.port,
      secure: config.secure,
      auth: config.user ? config.accessToken ? { type: "OAuth2", user: config.user, accessToken: config.accessToken } : { user: config.user, pass: config.password ?? "" } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<MailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.fromName ? `"${this.config.fromName}" <${this.config.from}>` : this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo ?? this.config.replyTo,
        attachments: message.attachments,
      });
      const accepted = (info.accepted ?? []).map((entry: string | { address: string }) =>
        typeof entry === "string" ? entry : entry.address,
      );
      return {
        delivered: accepted.length > 0,
        transport: "smtp",
        providerId: info.messageId,
        accepted,
        ...(accepted.length > 0 ? {} : { reason: "O servidor SMTP não aceitou o destinatário." }),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao enviar e-mail: ${reason}`);
      return { delivered: false, transport: "smtp", reason: reason.slice(0, 240), hint: explainSmtpError(reason) };
    }
  }

  async verify(): Promise<{ ok: boolean; detail?: string; hint?: string }> {
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (error) {
      const detail = (error instanceof Error ? error.message : String(error)).slice(0, 240);
      return { ok: false, detail, hint: explainSmtpError(detail) };
    }
  }

  close(): void {
    this.transporter.close();
  }
}

