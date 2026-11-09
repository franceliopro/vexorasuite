export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

/**
 * Outcome of a delivery attempt.
 *
 * `delivered: true` means the SMTP server accepted the message for delivery — not that it reached
 * the inbox. Everything else (log-only transport, disabled mail, refused recipient, timeout) is
 * reported as false with the reason, so callers never announce a delivery that did not happen.
 */
export interface MailResult {
  delivered: boolean;
  transport: "smtp" | "log" | "off";
  reason?: string;
  /** Actionable sentence for the operator, when the provider error has a known cause. */
  hint?: string;
  providerId?: string;
  accepted?: string[];
}

export interface MailTransport {
  readonly kind: "smtp" | "log" | "off";
  send(message: MailMessage): Promise<MailResult>;
  /** Real connection check, used by the diagnostics endpoint. */
  verify?(): Promise<{ ok: boolean; detail?: string; hint?: string }>;
  close?(): void;
}
