import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { assertImapConfigured, ImapSettings, resolveImapSettings } from "./imap.config";

export interface ImapVerification {
  ok: boolean;
  mailbox?: string;
  messages?: number;
  detail?: string;
}

export interface InboundMail {
  uid: number;
  messageId?: string;
  inReplyTo?: string;
  references: string[];
  subject: string;
  from: string[];
  to: string[];
  cc: string[];
  text: string;
  html?: string;
  date?: Date;
  attachments: Array<{ filename?: string; contentType?: string; size: number }>;
}

const addresses = (value: unknown): string[] => {
  if (!value || typeof value !== "object") return [];
  const list = Array.isArray((value as { value?: unknown }).value) ? (value as { value: Array<{ address?: string }> }).value : [];
  return list.map((item) => item.address?.trim()).filter((item): item is string => Boolean(item));
};

export class ImapMailTransport {
  private readonly settings: ImapSettings;

  constructor(settings = resolveImapSettings()) {
    assertImapConfigured(settings);
    this.settings = settings;
  }

  async verify(): Promise<ImapVerification> {
    const client = this.client();
    try {
      await client.connect();
      const mailbox = await client.mailboxOpen(this.settings.mailbox);
      return { ok: true, mailbox: this.settings.mailbox, messages: mailbox.exists };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    } finally {
      await client.logout().catch(() => client.close());
    }
  }

  async fetchRecent(limit = 25): Promise<InboundMail[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const client = this.client();
    await client.connect();
    const lock = await client.getMailboxLock(this.settings.mailbox);
    try {
      const uidNext = client.mailbox && typeof client.mailbox === "object" && typeof client.mailbox.uidNext === "number" ? client.mailbox.uidNext : 1;
      // The range is expressed in UIDs, not sequence numbers. Sequence numbers shift after
      // expunges, while UID/UIDVALIDITY remains stable for incremental mailbox reads.
      const startUid = Math.max(1, uidNext - safeLimit);
      const rows: Array<{ uid: number; source: Buffer }> = [];
      for await (const message of client.fetch(`${startUid}:*`, { uid: true, source: true }, { uid: true })) {
        if (message.uid && message.source) rows.push({ uid: message.uid, source: Buffer.from(message.source) });
      }
      const parsed: InboundMail[] = [];
      for (const row of rows) {
        const mail = await simpleParser(row.source);
        parsed.push({
          uid: row.uid,
          messageId: mail.messageId,
          inReplyTo: mail.inReplyTo,
          references: Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : [],
          subject: mail.subject || "",
          from: addresses(mail.from),
          to: addresses(mail.to),
          cc: addresses(mail.cc),
          text: mail.text || "",
          html: typeof mail.html === "string" ? mail.html : undefined,
          date: mail.date,
          attachments: mail.attachments.map((attachment) => ({
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size,
          })),
        });
      }
      return parsed;
    } finally {
      lock.release();
      await client.logout().catch(() => client.close());
    }
  }

  private client(): ImapFlow {
    assertImapConfigured(this.settings);
    return new ImapFlow({
      host: this.settings.host,
      port: this.settings.port,
      secure: this.settings.secure,
      auth: { user: this.settings.user, pass: this.settings.password },
      logger: false,
    });
  }
}
