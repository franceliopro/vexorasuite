import { Injectable, Logger, Optional, OnModuleDestroy } from "@nestjs/common";
import { MailMessage, MailResult, MailTransport } from "./mail.types";
import {
  MailField,
  MailMode,
  MailSettings,
  mailProblem,
  maskAddress,
  resolveMailSettings,
} from "./mail.config";
import { SmtpMailTransport } from "./transports/smtp.transport";
import { LogMailTransport } from "./transports/log.transport";
import { OffMailTransport } from "./transports/off.transport";

export interface MailStatus {
  transport: "smtp" | "log" | "off";
  configured: boolean;
  mode: MailMode;
  service?: string;
  host?: string;
  port: number;
  secure: boolean;
  from?: string;
  /** Masked: diagnostics never echo a full address or any secret. */
  user?: string;
  fromName?: string;
  replyTo?: string;
  /** Which variable supplied each value, so a wrong variable name is visible instead of silent. */
  sources: Partial<Record<MailField, string>>;
  missing: string[];
  /** Present in the environment but empty — usually a variable created outside the compose scope. */
  blank: string[];
  warnings: string[];
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
  private resolvedSettings?: MailSettings;

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
    const settings = this.resolved;
    const transport = this.transport;
    return {
      transport: transport.kind,
      configured: transport.kind === "smtp",
      mode: settings.mode,
      service: settings.service,
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      from: settings.from,
      user: maskAddress(settings.user),
      fromName: settings.fromName,
      replyTo: settings.replyTo,
      sources: settings.sources,
      missing: settings.missing,
      blank: settings.blank,
      warnings: settings.warnings,
      note: mailProblem(settings),
    };
  }

  /** Resolved configuration, shared by the status endpoint and the `mail:check` CLI. */
  get resolved(): MailSettings {
    this.resolvedSettings ??= resolveMailSettings();
    return this.resolvedSettings;
  }

  private get transport(): MailTransport {
    if (this.injected) return this.injected;
    this.channel ??= this.fromEnvironment();
    return this.channel;
  }

  private fromEnvironment(): MailTransport {
    const settings = this.resolved;
    if (settings.mode === "off") return new OffMailTransport();
    if (settings.mode === "log") {
      // Only warn when delivery was attempted and the variables are incomplete: a development
      // process with no mail configured is not an incident, a production one is.
      if (settings.missing.length > 0) this.logger.warn(mailProblem(settings));
      return new LogMailTransport();
    }
    for (const warning of settings.warnings) this.logger.warn(warning);
    return new SmtpMailTransport({
      service: settings.service,
      host: settings.host!,
      port: settings.port,
      secure: settings.secure,
      user: settings.user,
      password: settings.password,
      from: settings.from!,
      fromName: settings.fromName,
      replyTo: settings.replyTo,
    });
  }
}

