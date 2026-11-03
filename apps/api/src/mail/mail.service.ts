import { Injectable, Logger, Optional, OnModuleDestroy } from "@nestjs/common";
import { MailMessage, MailResult, MailTransport } from "./mail.types";
import { SmtpMailTransport } from "./transports/smtp.transport";
import { LogMailTransport } from "./transports/log.transport";
import { OffMailTransport } from "./transports/off.transport";

export interface MailStatus {
  transport: "smtp" | "log" | "off";
  configured: boolean;
  from?: string;
  host?: string;
  note: string;
}

/**
 * Single entry point for outgoing e-mail.
 *
 * The transport is chosen once from the environment:
 *
 * - `MAIL_TRANSPORT=smtp` (and `MAIL_HOST` + `MAIL_FROM`) → real delivery via nodemailer.
 * - `MAIL_TRANSPORT=log`, or SMTP details missing → message is written to the log and reported as
 *   **not delivered**, so nobody announces an e-mail that never left the process.
 * - `MAIL_TRANSPORT=off` → nothing happens.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private channel?: MailTransport;

  constructor(@Optional() private readonly injected?: MailTransport) {}

  onModuleDestroy(): void {
    this.channel?.close?.();
  }

  get configured(): boolean {
    return this.transport.kind === "smtp";
  }

  async send(message: MailMessage): Promise<MailResult> {
    if (!message.to || !message.to.includes("@")) {
      return { delivered: false, transport: this.transport.kind, reason: "Destinatário inválido." };
    }
    const result = await this.transport.send(message);
    if (!result.delivered) {
      this.logger.warn(`E-mail para ${message.to} não entregue: ${result.reason ?? "motivo não informado"}`);
    }
    return result;
  }

  /** Real SMTP handshake. Configuration alone is never reported as a working integration. */
  async verify(): Promise<{ ok: boolean; transport: string; detail?: string }> {
    const transport = this.transport;
    if (!transport.verify) {
      return {
        ok: false,
        transport: transport.kind,
        detail:
          transport.kind === "off"
            ? "Envio desativado neste ambiente."
            : "Transporte sem verificação de conexão (SMTP não configurado).",
      };
    }
    const result = await transport.verify();
    return { ok: result.ok, transport: transport.kind, detail: result.detail };
  }

  status(): MailStatus {
    const transport = this.transport;
    return {
      transport: transport.kind,
      configured: transport.kind === "smtp",
      from: process.env.MAIL_FROM?.trim() || undefined,
      host: transport.kind === "smtp" ? process.env.MAIL_HOST?.trim() || undefined : undefined,
      note:
        transport.kind === "smtp"
          ? "SMTP configurado. Use POST /api/mail/verify para confirmar a conexão."
          : "Sem SMTP configurado: e-mails são apenas registrados no log e reportados como não entregues.",
    };
  }

  private get transport(): MailTransport {
    if (this.injected) return this.injected;
    this.channel ??= this.fromEnvironment();
    return this.channel;
  }

  private fromEnvironment(): MailTransport {
    const mode = (process.env.MAIL_TRANSPORT || "").trim().toLowerCase();
    if (mode === "off") return new OffMailTransport();
    if (mode === "log") return new LogMailTransport();

    const host = (process.env.MAIL_HOST || "").trim();
    const from = (process.env.MAIL_FROM || "").trim();
    if (!host || !from) {
      if (mode === "smtp") {
        this.logger.warn("MAIL_TRANSPORT=smtp sem MAIL_HOST e MAIL_FROM: o envio segue desativado.");
      }
      return new LogMailTransport();
    }

    const port = Number(process.env.MAIL_PORT || 587);
    const secure = process.env.MAIL_SECURE ? process.env.MAIL_SECURE === "true" : port === 465;
    return new SmtpMailTransport({
      host,
      port,
      secure,
      user: process.env.MAIL_USER?.trim() || undefined,
      password: process.env.MAIL_PASSWORD || undefined,
      from,
      fromName: process.env.MAIL_FROM_NAME?.trim() || undefined,
      replyTo: process.env.MAIL_REPLY_TO?.trim() || undefined,
    });
  }
}
