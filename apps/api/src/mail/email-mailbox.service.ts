import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../operations/events.service";
import { SmtpMailTransport } from "./transports/smtp.transport";
import { JobLeaseService } from "../common/job-lease.service";
import { schedulersEnabled } from "../common/scheduler-mode";

type MailboxInput = {
  name?: unknown; address?: unknown; imapHost?: unknown; imapPort?: unknown; imapSecure?: unknown; imapUser?: unknown; imapPassword?: unknown; imapMailbox?: unknown;
  smtpHost?: unknown; smtpPort?: unknown; smtpSecure?: unknown; smtpUser?: unknown; smtpPassword?: unknown; smtpFrom?: unknown; smtpFromName?: unknown;
};
type MailboxSettings = {
  id: string; tenantId: string; address: string; imapHost: string; imapPort: number; imapSecure: boolean; imapUser: string; imapPasswordEncrypted: string; imapMailbox: string;
  smtpHost: string | null; smtpPort: number | null; smtpSecure: boolean | null; smtpUser: string | null; smtpPasswordEncrypted: string | null; smtpFrom: string | null; smtpFromName: string | null; channelConnectionId: string;
};
const MAX_SYNC_MESSAGES = 50;
const MAX_MESSAGE_TEXT = 200_000;
const MAX_ATTACHMENT_META = 50;

@Injectable()
export class EmailMailboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailMailboxService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly leases?: JobLeaseService) {}

  onModuleInit(): void {
    if (!schedulersEnabled()) return;
    this.timer = setInterval(() => void this.scheduledSync(), 60_000);
    this.timer.unref();
    void this.scheduledSync();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private async scheduledSync(): Promise<void> {
    if (this.running || (this.leases && !(await this.leases.claim("email-mailbox-sync", 55_000)))) return;
    this.running = true;
    try { await this.syncAll(); } catch (error) { this.logger.warn("Falha no ciclo de sincronização de e-mail: " + (error instanceof Error ? error.message : String(error))); }
    finally { this.running = false; }
  }

  private key(): Buffer {
    const value = process.env.INTEGRATION_ENCRYPTION_KEY || "";
    if (!/^[a-f0-9]{64}$/i.test(value)) throw new ServiceUnavailableException("INTEGRATION_ENCRYPTION_KEY não configurada para a caixa de e-mail.");
    return Buffer.from(value, "hex");
  }
  private encrypt(value: string): string {
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
  }
  private decrypt(value: string): string {
    try {
      const parts = value.split(".");
      if (parts.length !== 3) throw new Error("invalid");
      const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(parts[0]!, "base64url"));
      decipher.setAuthTag(Buffer.from(parts[1]!, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(parts[2]!, "base64url")), decipher.final()]).toString("utf8");
    } catch { throw new ServiceUnavailableException("Credencial da caixa de e-mail inválida. Atualize a configuração."); }
  }
  private text(input: unknown, field: string, max = 320): string {
    if (typeof input !== "string" || !input.trim() || input.trim().length > max) throw new BadRequestException(field + " inválido.");
    return input.trim();
  }
  private optionalText(input: unknown, field: string, max = 320): string | null {
    if (input === undefined || input === null || input === "") return null;
    if (typeof input !== "string" || input.trim().length > max) throw new BadRequestException(field + " inválido.");
    return input.trim();
  }
  private port(input: unknown, field: string, fallback: number): number {
    if (input === undefined || input === null || input === "") return fallback;
    const value = Number(input);
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new BadRequestException(field + " inválida.");
    return value;
  }
  private bool(input: unknown, fallback: boolean): boolean {
    if (input === undefined || input === null || input === "") return fallback;
    if (typeof input === "boolean") return input;
    if (typeof input === "string" && ["true", "1", "yes", "on"].includes(input.toLowerCase())) return true;
    if (typeof input === "string" && ["false", "0", "no", "off"].includes(input.toLowerCase())) return false;
    throw new BadRequestException("Valor booleano inválido.");
  }

  async list(tenantId: string) {
    const rows = await this.prisma.emailMailbox.findMany({
      where: { tenantId }, orderBy: { address: "asc" },
      select: { id: true, address: true, imapHost: true, imapPort: true, imapSecure: true, imapUser: true, imapMailbox: true, smtpHost: true, smtpPort: true, smtpSecure: true, smtpFrom: true, smtpFromName: true, status: true, lastError: true, lastSyncAt: true, channelConnectionId: true },
    });
    return rows.map((row) => ({ ...row, imapUser: row.imapUser.replace(/^(.{2}).*(@.*)$/, "$1***$2"), configured: true }));
  }

  async create(tenantId: string, input: MailboxInput) {
    const address = this.text(input.address, "Endereço de e-mail", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new BadRequestException("Endereço de e-mail inválido.");
    const imapHost = this.text(input.imapHost, "Servidor IMAP", 253).replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
    const imapUser = this.text(input.imapUser ?? address, "Usuário IMAP", 254);
    const imapPassword = this.text(input.imapPassword, "Senha IMAP", 512);
    const name = this.text(input.name ?? address, "Nome da caixa", 120);
    const imapMailbox = this.optionalText(input.imapMailbox, "Pasta IMAP", 120) || "INBOX";
    const smtpHost = this.optionalText(input.smtpHost, "Servidor SMTP", 253);
    const smtpUser = this.optionalText(input.smtpUser, "Usuário SMTP", 254);
    const smtpPassword = this.optionalText(input.smtpPassword, "Senha SMTP", 512);
    const smtpFrom = this.optionalText(input.smtpFrom, "Remetente SMTP", 254) || address;
    const smtpFromName = this.optionalText(input.smtpFromName, "Nome do remetente", 120);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");

    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.channelConnection.create({
        data: { tenantId, provider: "EMAIL", name, sessionName: "email-" + randomBytes(12).toString("hex"), status: "PENDING", isActive: true, settings: { platform: "email", address } },
      });
      const mailbox = await tx.emailMailbox.create({
        data: {
          tenantId, channelConnectionId: channel.id, address, imapHost, imapPort: this.port(input.imapPort, "Porta IMAP", 993), imapSecure: this.bool(input.imapSecure, true), imapUser,
          imapPasswordEncrypted: this.encrypt(imapPassword), imapMailbox, smtpHost, smtpPort: smtpHost ? this.port(input.smtpPort, "Porta SMTP", 587) : null,
          smtpSecure: smtpHost ? this.bool(input.smtpSecure, false) : null, smtpUser, smtpPasswordEncrypted: smtpPassword ? this.encrypt(smtpPassword) : null, smtpFrom, smtpFromName, status: "PENDING",
        },
      });
      await tx.channelConnection.update({ where: { id: channel.id }, data: { settings: { platform: "email", address, mailboxId: mailbox.id } } });
      return { id: mailbox.id, channelConnectionId: channel.id, address, status: mailbox.status };
    }).catch((error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new BadRequestException("Esta caixa de e-mail já está cadastrada nesta empresa.");
      throw error;
    });
  }

  private async getMailbox(tenantId: string, id: string): Promise<MailboxSettings> {
    const row = await this.prisma.emailMailbox.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Caixa de e-mail não encontrada nesta empresa.");
    return row;
  }

  async verify(tenantId: string, id: string) {
    const row = await this.getMailbox(tenantId, id);
    const client = new ImapFlow({ host: row.imapHost, port: row.imapPort, secure: row.imapSecure, auth: { user: row.imapUser, pass: this.decrypt(row.imapPasswordEncrypted) }, logger: false });
    try {
      await client.connect();
      const mailbox = await client.mailboxOpen(row.imapMailbox);
      await this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "CONNECTED", lastError: null } });
      await this.prisma.channelConnection.update({ where: { id: row.channelConnectionId }, data: { status: "CONNECTED", lastError: null } });
      return { ok: true, messages: mailbox.exists, mailbox: row.imapMailbox };
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 240) : "Falha de conexão IMAP.";
      await this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "ERROR", lastError: detail } });
      await this.prisma.channelConnection.update({ where: { id: row.channelConnectionId }, data: { status: "ERROR", lastError: detail } });
      return { ok: false, detail };
    } finally { await client.logout().catch(() => client.close()); }
  }

  async syncAll(): Promise<void> {
    const mailboxes = await this.prisma.emailMailbox.findMany({ where: { status: { in: ["CONNECTED", "SYNCING"] } }, select: { id: true, tenantId: true } });
    for (const mailbox of mailboxes) await this.sync(mailbox.tenantId, mailbox.id);
  }

  async sync(tenantId: string, id: string): Promise<{ imported: number; skipped: number }> {
    const row = await this.getMailbox(tenantId, id);
    if (!["CONNECTED", "SYNCING"].includes(row.status)) return { imported: 0, skipped: 0 };
    const client = new ImapFlow({ host: row.imapHost, port: row.imapPort, secure: row.imapSecure, auth: { user: row.imapUser, pass: this.decrypt(row.imapPasswordEncrypted) }, logger: false });
    let imported = 0, skipped = 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock(row.imapMailbox);
      try {
        const box = client.mailbox;
        if (!box) throw new Error("Pasta IMAP indisponível.");
        const uidValidity = Number(box.uidValidity || 0);
        const startUid = row.syncUidValidity === uidValidity ? row.syncLastUid + 1 : 1;
        await this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "SYNCING", syncUidValidity: uidValidity || null } });
        const messages: Array<{ uid: number; source: Buffer }> = [];
        for await (const item of client.fetch({ uid: String(startUid) + ":*" }, { uid: true, source: true }, { uid: true })) {
          if (messages.length >= MAX_SYNC_MESSAGES) break;
          if (item.uid && item.source) messages.push({ uid: item.uid, source: Buffer.from(item.source) });
        }
        for (const item of messages) {
          const providerId = "email:" + row.id + ":" + uidValidity + ":" + item.uid;
          const exists = await this.prisma.message.findFirst({ where: { tenantId, providerMessageId: providerId }, select: { id: true } });
          if (exists) { skipped++; continue; }
          const mail = await simpleParser(item.source);
          const from = mail.from?.value?.[0]?.address?.toLowerCase() || row.address;
          const subject = (mail.subject || "").trim().slice(0, 500) || "(sem assunto)";
          const references = Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references];
          const threadKey = references[0] || mail.inReplyTo || mail.messageId || "subject:" + subject.toLocaleLowerCase("pt-BR");
          const contact = await this.prisma.contact.findFirst({ where: { tenantId, email: from } }) || await this.prisma.contact.create({ data: { tenantId, name: mail.from?.value?.[0]?.name?.trim() || from, email: from, source: "EMAIL" } });
          let conversation = await this.prisma.conversation.findFirst({ where: { tenantId, channelConnectionId: row.channelConnectionId, emailThreadKey: threadKey } });
          if (!conversation) conversation = await this.prisma.conversation.create({ data: { tenantId, contactId: contact.id, channelConnectionId: row.channelConnectionId, channel: "EMAIL", subject, emailThreadKey: threadKey, status: "OPEN", lastMessageAt: mail.date || new Date() } });
          const body = (mail.text || (typeof mail.html === "string" ? mail.html.replace(/<[^>]*>/g, " ") : "")).slice(0, MAX_MESSAGE_TEXT);
          const message = await this.prisma.message.create({ data: { tenantId, conversationId: conversation.id, providerMessageId: providerId, direction: "INBOUND", status: "RECEIVED", content: body, contentType: mail.html ? "html" : "text", senderName: mail.from?.value?.[0]?.name || from, occurredAt: mail.date || new Date(), metadata: { provider: "EMAIL", mailboxId: row.id, uid: item.uid, uidValidity, messageId: mail.messageId || null, inReplyTo: mail.inReplyTo || null, references, subject, from, to: mail.to?.value?.map((entry) => entry.address).filter(Boolean) || [], cc: mail.cc?.value?.map((entry) => entry.address).filter(Boolean) || [], html: typeof mail.html === "string" ? mail.html.slice(0, MAX_MESSAGE_TEXT) : null, attachments: mail.attachments.slice(0, MAX_ATTACHMENT_META).map((entry) => ({ filename: entry.filename, contentType: entry.contentType, size: entry.size })) } } });
          await this.prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.occurredAt, subject: conversation.subject || subject } });
          this.events.publish(tenantId, "message.received", { conversationId: conversation.id, message: { id: message.id, direction: message.direction, status: message.status, content: message.content, occurredAt: message.occurredAt.toISOString(), channel: "EMAIL" } });
          imported++;
        }
        await this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "CONNECTED", lastSyncAt: new Date(), lastError: null, ...(messages.length ? { syncLastUid: messages[messages.length - 1]!.uid } : {}) } });
      } finally { lock.release(); }
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 240) : "Falha na sincronização da caixa.";
      await this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "ERROR", lastError: detail } });
      this.logger.warn("Falha ao sincronizar mailbox " + row.id + ": " + detail);
      throw new BadGatewayException("Não foi possível sincronizar a caixa de e-mail.");
    } finally { await client.logout().catch(() => client.close()); }
    return { imported, skipped };
  }

  async send(tenantId: string, conversationId: string, text: string, userId: string) {
    if (typeof text !== "string" || !text.trim() || text.length > MAX_MESSAGE_TEXT) throw new BadRequestException("Mensagem de e-mail inválida.");
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId, channel: "EMAIL" }, include: { contact: true, channelConnection: { include: { emailMailbox: true } } } });
    if (!conversation?.channelConnection?.emailMailbox) throw new NotFoundException("Inbox de e-mail não encontrada para esta conversa.");
    const mailbox = conversation.channelConnection.emailMailbox;
    if (!mailbox.smtpHost || !mailbox.smtpUser || !mailbox.smtpPasswordEncrypted || !mailbox.smtpFrom) throw new ServiceUnavailableException("SMTP de resposta não configurado para esta caixa.");
    const transport = new SmtpMailTransport({ host: mailbox.smtpHost, port: mailbox.smtpPort || 587, secure: mailbox.smtpSecure === true, user: mailbox.smtpUser, password: this.decrypt(mailbox.smtpPasswordEncrypted), from: mailbox.smtpFrom, fromName: mailbox.smtpFromName || undefined });
    const subject = conversation.subject?.startsWith("Re:") ? conversation.subject : "Re: " + (conversation.subject || "(sem assunto)");
    const result = await transport.send({ to: conversation.contact.email || "", subject, text: text.trim(), replyTo: mailbox.address });
    transport.close();
    if (!result.delivered) throw new BadGatewayException(result.reason || "O servidor SMTP não aceitou a resposta.");
    const message = await this.prisma.message.create({ data: { tenantId, conversationId, providerMessageId: result.providerId || null, direction: "OUTBOUND", status: "SENT", content: text.trim(), contentType: "text", senderName: mailbox.smtpFrom, metadata: { provider: "EMAIL", mailboxId: mailbox.id, replyTo: conversation.contact.email, senderUserId: userId }, occurredAt: new Date() } });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.occurredAt, status: "OPEN" } });
    this.events.publish(tenantId, "message.sent", { conversationId, message: { id: message.id, direction: message.direction, status: message.status, content: message.content, occurredAt: message.occurredAt.toISOString(), channel: "EMAIL" } });
    return message;
  }
}
