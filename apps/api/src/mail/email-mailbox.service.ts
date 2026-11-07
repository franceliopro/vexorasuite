import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../operations/events.service";
import { SmtpMailTransport } from "./transports/smtp.transport";
import { JobLeaseService } from "../common/job-lease.service";
import { schedulersEnabled } from "../common/scheduler-mode";
import { mailHost } from "../communications/security";
import { GoogleAccessService } from "../operations/google-access.service";

type MailboxInput = {
  name?: unknown; address?: unknown; imapHost?: unknown; imapPort?: unknown; imapSecure?: unknown; imapUser?: unknown; imapPassword?: unknown; imapMailbox?: unknown;
  smtpHost?: unknown; smtpPort?: unknown; smtpSecure?: unknown; smtpUser?: unknown; smtpPassword?: unknown; smtpFrom?: unknown; smtpFromName?: unknown;
  authMode?: unknown; googleConnectionId?: unknown;
};
type MailboxSettings = {
  id: string; tenantId: string; address: string; imapHost: string; imapPort: number; imapSecure: boolean; imapUser: string; imapPasswordEncrypted: string | null; authMode: string; googleConnectionId: string | null; imapMailbox: string; status: string; syncUidValidity: number | null; syncLastUid: number;
  smtpHost: string | null; smtpPort: number | null; smtpSecure: boolean | null; smtpUser: string | null; smtpPasswordEncrypted: string | null; smtpFrom: string | null; smtpFromName: string | null; channelConnectionId: string;
};
const IMAP_CONNECTION_TIMEOUT_MS = 10_000;
const IMAP_SOCKET_TIMEOUT_MS = 20_000;
const MAX_SYNC_MESSAGES = 50;
const MAX_MESSAGE_TEXT = 200_000;
const MAX_ATTACHMENT_META = 50;
const MAX_OUTBOUND_ATTACHMENT_BYTES = 16 * 1024 * 1024;
type EmailAttachment = { filename: string; contentType: string; data: string };

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
type EmailThreadHeaders = { messageId?: unknown; inReplyTo?: unknown; references?: unknown };

function normalizeEmailMessageId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\r?\n[ \t]+/g, " ").replace(/\\[rnt]/g, " ").replace(/\s+/g, " ").trim();
  const normalized = compact.replace(/^<+|>+$/g, "").replace(/\s+/g, "").toLocaleLowerCase("en-US");
  return normalized && !/[<>\r\n]/.test(normalized) ? normalized : null;
}

function normalizedEmailReferences(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.map(normalizeEmailMessageId).filter((entry): entry is string => Boolean(entry));
}

export function emailThreadKeys(headers: EmailThreadHeaders, fallbackKey: string): string[] {
  const references = normalizedEmailReferences(headers.references);
  const candidates = [
    normalizeEmailMessageId(headers.messageId),
    normalizeEmailMessageId(headers.inReplyTo),
    ...references,
    fallbackKey ? "provider:" + fallbackKey : null,
  ];
  return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
}


@Injectable()
export class EmailMailboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailMailboxService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly leases?: JobLeaseService, private readonly google?: GoogleAccessService) {}

  private async auth(row: MailboxSettings): Promise<{ user: string; pass?: string; accessToken?: string }> {
    if (row.authMode === "GOOGLE_OAUTH") {
      if (!row.googleConnectionId || !this.google) throw new ServiceUnavailableException("Conecte uma conta Gmail OAuth para esta caixa.");
      return { user: row.imapUser || row.address, accessToken: await this.google.token(row.tenantId, row.googleConnectionId, "gmail") };
    }
    if (!row.imapPasswordEncrypted) throw new ServiceUnavailableException("Senha IMAP não configurada para esta caixa.");
    return { user: row.imapUser, pass: this.decrypt(row.imapPasswordEncrypted) };
  }

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
      select: { id: true, address: true, imapHost: true, imapPort: true, imapSecure: true, imapUser: true, imapMailbox: true, authMode: true, googleConnectionId: true, smtpHost: true, smtpPort: true, smtpSecure: true, smtpUser: true, smtpFrom: true, smtpFromName: true, status: true, lastError: true, lastSyncAt: true, channelConnectionId: true },
    });
    return rows.map((row) => ({ ...row, imapUser: row.imapUser.replace(/^(.{2}).*(@.*)$/, "$1***$2"), configured: true }));
  }

  async create(tenantId: string, input: MailboxInput) {
    const address = this.text(input.address, "Endereço de e-mail", 254).toLowerCase();
    if (!isValidEmailAddress(address)) throw new BadRequestException("Endereço de e-mail inválido.");
    const authMode = input.authMode === "GOOGLE_OAUTH" ? "GOOGLE_OAUTH" : "PASSWORD";
    const googleConnectionId = this.optionalText(input.googleConnectionId, "Conta Google", 80);
    if (authMode === "GOOGLE_OAUTH") {
      if (!googleConnectionId) throw new BadRequestException("Selecione a conta Gmail autorizada.");
      const account = await this.prisma.googleConnection.findFirst({ where: { id: googleConnectionId, tenantId } });
      if (!account || account.email.toLowerCase() !== address || !account.scopes.includes("https://mail.google.com/")) throw new BadRequestException("A conta Gmail autorizada precisa ser a mesma da caixa e possuir permissão de e-mail.");
    }
    const imapHost = this.text(input.imapHost, "Servidor IMAP", 253).replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
    await mailHost(imapHost);
    const imapUser = this.text(input.imapUser ?? address, "Usuário IMAP", 254);
    const imapPassword = authMode === "GOOGLE_OAUTH" ? null : this.text(input.imapPassword, "Senha IMAP", 512);
    const name = this.text(input.name ?? address, "Nome da caixa", 120);
    const imapMailbox = this.optionalText(input.imapMailbox, "Pasta IMAP", 120) || "INBOX";
    const smtpHost = this.optionalText(input.smtpHost, "Servidor SMTP", 253);
    if (smtpHost) await mailHost(smtpHost);
    const smtpUser = this.optionalText(input.smtpUser, "Usuário SMTP", 254);
    const smtpPassword = this.optionalText(input.smtpPassword, "Senha SMTP", 512);
    if (smtpHost && (!smtpUser || (authMode !== "GOOGLE_OAUTH" && !smtpPassword))) throw new BadRequestException("A configuração SMTP exige usuário e senha ou OAuth Gmail.");
    const smtpFrom = this.optionalText(input.smtpFrom, "Remetente SMTP", 254) || address;
    if (!isValidEmailAddress(smtpFrom)) throw new BadRequestException("Remetente SMTP inválido.");
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
          imapPasswordEncrypted: imapPassword ? this.encrypt(imapPassword) : null, authMode, googleConnectionId, imapMailbox, smtpHost, smtpPort: smtpHost ? this.port(input.smtpPort, "Porta SMTP", 587) : null,
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

  async update(tenantId: string, id: string, input: MailboxInput) {
    const current = await this.getMailbox(tenantId, id);
    const address = this.text(input.address ?? current.address, "Endereço de e-mail", 254).toLowerCase();
    if (!isValidEmailAddress(address)) throw new BadRequestException("Endereço de e-mail inválido.");
    const authMode = input.authMode === undefined ? current.authMode : input.authMode === "GOOGLE_OAUTH" ? "GOOGLE_OAUTH" : "PASSWORD";
    const googleConnectionId = this.optionalText(input.googleConnectionId ?? current.googleConnectionId, "Conta Google", 80);
    if (authMode === "GOOGLE_OAUTH") {
      if (!googleConnectionId) throw new BadRequestException("Selecione a conta Gmail autorizada.");
      const account = await this.prisma.googleConnection.findFirst({ where: { id: googleConnectionId, tenantId } });
      if (!account || account.email.toLowerCase() !== address || !account.scopes.includes("https://mail.google.com/")) throw new BadRequestException("A conta Gmail autorizada precisa ser a mesma da caixa e possuir permissão de e-mail.");
    }
    const imapHost = this.text(input.imapHost ?? current.imapHost, "Servidor IMAP", 253).replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
    await mailHost(imapHost);
    const imapUser = input.imapUser === undefined || input.imapUser === "" ? current.imapUser : this.text(input.imapUser, "Usuário IMAP", 254);
    const imapPassword = authMode === "GOOGLE_OAUTH" ? null : this.optionalText(input.imapPassword, "Senha IMAP", 512);
    const imapMailbox = this.optionalText(input.imapMailbox ?? current.imapMailbox, "Pasta IMAP", 120) || "INBOX";
    const smtpHost = this.optionalText(input.smtpHost ?? current.smtpHost, "Servidor SMTP", 253);
    if (smtpHost) await mailHost(smtpHost);
    const smtpUser = this.optionalText(input.smtpUser ?? current.smtpUser, "Usuário SMTP", 254);
    const smtpPassword = this.optionalText(input.smtpPassword, "Senha SMTP", 512);
    if (smtpHost && (!smtpUser || (authMode !== "GOOGLE_OAUTH" && !smtpPassword && !current.smtpPasswordEncrypted))) throw new BadRequestException("A configuração SMTP exige usuário e senha ou OAuth Gmail.");
    const smtpFrom = this.optionalText(input.smtpFrom ?? current.smtpFrom, "Remetente SMTP", 254) || address;
    if (!isValidEmailAddress(smtpFrom)) throw new BadRequestException("Remetente SMTP inválido.");
    const imapChanged = imapHost !== current.imapHost || imapUser !== current.imapUser || imapMailbox !== current.imapMailbox || this.port(input.imapPort, "Porta IMAP", current.imapPort) !== current.imapPort || this.bool(input.imapSecure, current.imapSecure) !== current.imapSecure;
    const result = await this.prisma.$transaction(async (tx) => {
      const mailbox = await tx.emailMailbox.update({ where: { id: current.id }, data: {
        address, imapHost, imapPort: this.port(input.imapPort, "Porta IMAP", current.imapPort), imapSecure: this.bool(input.imapSecure, current.imapSecure), imapUser, authMode, googleConnectionId,
        ...(imapPassword ? { imapPasswordEncrypted: this.encrypt(imapPassword) } : authMode === "GOOGLE_OAUTH" ? { imapPasswordEncrypted: null } : {}), imapMailbox,
        smtpHost, smtpPort: smtpHost ? this.port(input.smtpPort, "Porta SMTP", current.smtpPort || 587) : null, smtpSecure: smtpHost ? this.bool(input.smtpSecure, current.smtpSecure ?? false) : null,
        smtpUser, ...(smtpPassword ? { smtpPasswordEncrypted: this.encrypt(smtpPassword) } : authMode === "GOOGLE_OAUTH" ? { smtpPasswordEncrypted: null } : { smtpPasswordEncrypted: smtpHost ? current.smtpPasswordEncrypted : null }), smtpFrom, smtpFromName: this.optionalText(input.smtpFromName ?? current.smtpFromName, "Nome do remetente", 120),
        status: "PENDING", lastError: null, ...(imapChanged ? { syncUidValidity: null, syncLastUid: 0, lastSyncAt: null } : {}),
      } });
      await tx.channelConnection.update({ where: { id: current.channelConnectionId }, data: { name: this.optionalText(input.name, "Nome da caixa", 120) || address } });
      return mailbox;
    }).catch((error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new BadRequestException("Esta caixa de e-mail já está cadastrada nesta empresa.");
      throw error;
    });
    return { id: result.id, channelConnectionId: result.channelConnectionId, address: result.address, status: result.status };
  }

  private async getMailbox(tenantId: string, id: string): Promise<MailboxSettings> {
    const row = await this.prisma.emailMailbox.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Caixa de e-mail não encontrada nesta empresa.");
    return row;
  }

  private async verifySmtp(row: MailboxSettings): Promise<{ configured: boolean; ok: boolean | null; detail?: string; hint?: string }> {
    if (!row.smtpHost) return { configured: false, ok: null };
    if (!row.smtpUser || row.authMode === "PASSWORD" && !row.smtpPasswordEncrypted || !row.smtpFrom) {
      return { configured: true, ok: false, detail: "Configuração SMTP incompleta." };
    }
    let transport: SmtpMailTransport | undefined;
    try {
      const endpoint = await mailHost(row.smtpHost);
      const auth = await this.auth(row);
      transport = new SmtpMailTransport({
        host: endpoint,
        tlsServername: row.smtpHost,
        port: row.smtpPort || 587,
        secure: row.smtpSecure === true,
        user: auth.user,
        ...(auth.pass ? { password: auth.pass } : {}),
        ...(auth.accessToken ? { accessToken: auth.accessToken } : {}),
        from: row.smtpFrom,
        fromName: row.smtpFromName || undefined,
      });
      return { configured: true, ...(await transport.verify()) };
    } catch (error) {
      return { configured: true, ok: false, detail: error instanceof Error ? error.message.slice(0, 240) : "Falha de conexão SMTP." };
    } finally {
      transport?.close();
    }
  }

  async verify(tenantId: string, id: string) {
    const row = await this.getMailbox(tenantId, id);
    const imapEndpoint = await mailHost(row.imapHost);
    const auth = await this.auth(row);
    const client = new ImapFlow({ host: imapEndpoint, port: row.imapPort, secure: row.imapSecure, ...(row.imapSecure ? { tls: { servername: row.imapHost } } : {}), auth, logger: false, connectionTimeout: IMAP_CONNECTION_TIMEOUT_MS, socketTimeout: IMAP_SOCKET_TIMEOUT_MS });
    try {
      await client.connect();
      const mailbox = await client.mailboxOpen(row.imapMailbox);
      const smtp = await this.verifySmtp(row);
      const ok = smtp.ok !== false;
      const status = ok ? "CONNECTED" : "ERROR";
      const lastError = ok ? null : smtp.detail || "Falha na verificação SMTP.";
      await this.prisma.$transaction([
        this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status, lastError } }),
        this.prisma.channelConnection.update({ where: { id: row.channelConnectionId }, data: { status, lastError } }),
      ]);
      this.events.publish(tenantId, "channel.status", { id: row.channelConnectionId, status, provider: "EMAIL", ...(lastError ? { lastError } : {}) });
      return { ok, messages: mailbox.exists, mailbox: row.imapMailbox, smtp };
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 240) : "Falha de conexão IMAP.";
      await this.prisma.$transaction([
        this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "ERROR", lastError: detail } }),
        this.prisma.channelConnection.update({ where: { id: row.channelConnectionId }, data: { status: "ERROR", lastError: detail } }),
      ]);
      this.events.publish(tenantId, "channel.status", { id: row.channelConnectionId, status: "ERROR", provider: "EMAIL", lastError: detail });
      return { ok: false, detail };
    } finally { await client.logout().catch(() => client.close()); }
  }
  async syncAll(): Promise<void> {
    const retryBefore = new Date(Date.now() - 5 * 60_000);
    const mailboxes = await this.prisma.emailMailbox.findMany({
      where: { OR: [{ status: { in: ["CONNECTED", "SYNCING"] } }, { status: "ERROR", updatedAt: { lt: retryBefore } }] },
      select: { id: true, tenantId: true },
    });
    for (const mailbox of mailboxes) {
      try { await this.sync(mailbox.tenantId, mailbox.id); }
      catch (error) { this.logger.warn("Falha isolada na caixa " + mailbox.id + ": " + (error instanceof Error ? error.message : String(error))); }
    }
  }

  async sync(tenantId: string, id: string): Promise<{ imported: number; skipped: number }> {
    const row = await this.getMailbox(tenantId, id);
    if (!["CONNECTED", "SYNCING"].includes(row.status)) return { imported: 0, skipped: 0 };
    // Manual sync and the scheduler run in different processes; use the shared lease table
    // so only one process can pull a mailbox at a time.
    if (this.leases && !(await this.leases.claim("email-mailbox:" + id, 15 * 60_000))) return { imported: 0, skipped: 0 };
    const imapEndpoint = await mailHost(row.imapHost);
    const auth = await this.auth(row);
    const client = new ImapFlow({ host: imapEndpoint, port: row.imapPort, secure: row.imapSecure, ...(row.imapSecure ? { tls: { servername: row.imapHost } } : {}), auth, logger: false, connectionTimeout: IMAP_CONNECTION_TIMEOUT_MS, socketTimeout: IMAP_SOCKET_TIMEOUT_MS });
    let imported = 0, skipped = 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock(row.imapMailbox);
      try {
        const box = client.mailbox;
        if (!box) throw new Error("Pasta IMAP indisponível.");
        const uidValidity = Number(box.uidValidity || 0);
        const startUid = row.syncUidValidity === uidValidity ? row.syncLastUid + 1 : 1;
        await this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "SYNCING", syncUidValidity: uidValidity || null, ...(row.syncUidValidity !== uidValidity ? { syncLastUid: 0 } : {}) } });
        const messages: Array<{ uid: number; source: Buffer }> = [];
        for await (const item of client.fetch({ uid: String(startUid) + ":*" }, { uid: true, source: true }, { uid: true })) {
          if (messages.length >= MAX_SYNC_MESSAGES) break;
          if (item.uid && item.source) messages.push({ uid: item.uid, source: Buffer.from(item.source) });
        }
        for (const item of messages) {
          const providerId = "email:" + row.id + ":" + uidValidity + ":" + item.uid;
          const exists = await this.prisma.message.findFirst({ where: { tenantId, providerMessageId: providerId }, select: { id: true, conversationId: true, occurredAt: true } });
          if (exists) {
            // A previous run may have committed the message before crashing while updating the
            // conversation. Reconcile that state instead of silently skipping it forever.
            await this.prisma.conversation.update({ where: { id: exists.conversationId }, data: { lastMessageAt: exists.occurredAt } });
            skipped++;
            continue;
          }
          const mail = await simpleParser(item.source);
          const from = mail.from?.value?.[0]?.address?.toLowerCase() || row.address;
          const subject = (mail.subject || "").trim().slice(0, 500) || "(sem assunto)";
          const addressList = (field: unknown): string[] => { const value = field && typeof field === "object" && "value" in field ? (field as { value?: unknown }).value : field; const entries = Array.isArray(value) ? value : [value]; return entries.map((entry) => entry && typeof entry === "object" && "address" in entry ? (entry as { address?: unknown }).address : null).filter((entry): entry is string => typeof entry === "string" && entry.length > 0); };
          const references = Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : [];
          const threadKeys = emailThreadKeys({ messageId: mail.messageId, inReplyTo: mail.inReplyTo, references }, providerId);
          const threadKey = threadKeys[0]!;
          const contact = await this.prisma.contact.findFirst({ where: { tenantId, email: from } }) || await this.prisma.contact.create({ data: { tenantId, name: mail.from?.value?.[0]?.name?.trim() || from, email: from, source: "EMAIL" } });
          let conversation = await this.prisma.conversation.findFirst({ where: { tenantId, channelConnectionId: row.channelConnectionId, emailThreadKey: { in: threadKeys } } });
          if (!conversation) conversation = await this.prisma.conversation.create({ data: { tenantId, contactId: contact.id, channelConnectionId: row.channelConnectionId, channel: "EMAIL", subject, emailThreadKey: threadKey, status: "OPEN", lastMessageAt: mail.date || new Date() } });
          const body = (mail.text || (typeof mail.html === "string" ? mail.html.replace(/<[^>]*>/g, " ") : "")).slice(0, MAX_MESSAGE_TEXT);
          const message = await this.prisma.message.create({ data: { tenantId, conversationId: conversation.id, providerMessageId: providerId, direction: "INBOUND", status: "RECEIVED", content: body, contentType: mail.html ? "html" : "text", senderName: mail.from?.value?.[0]?.name || from, occurredAt: mail.date || new Date(), metadata: { provider: "EMAIL", mailboxId: row.id, uid: item.uid, uidValidity, messageId: mail.messageId || null, inReplyTo: mail.inReplyTo || null, references, subject, from, to: addressList(mail.to), cc: addressList(mail.cc), html: typeof mail.html === "string" ? mail.html.slice(0, MAX_MESSAGE_TEXT) : null, attachments: mail.attachments.slice(0, MAX_ATTACHMENT_META).map((entry) => ({ filename: entry.filename, contentType: entry.contentType, size: entry.size })) } } });
          await this.prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.occurredAt, subject: conversation.subject || subject } });
          this.events.publish(tenantId, "message.received", { conversationId: conversation.id, message: { id: message.id, direction: message.direction, status: message.status, content: message.content, occurredAt: message.occurredAt.toISOString(), channel: "EMAIL" } });
          imported++;
        }
        await this.prisma.$transaction([
          this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "CONNECTED", lastSyncAt: new Date(), lastError: null, ...(messages.length ? { syncLastUid: messages[messages.length - 1]!.uid } : {}) } }),
          this.prisma.channelConnection.update({ where: { id: row.channelConnectionId }, data: { status: "CONNECTED", lastError: null } }),
        ]);
        this.events.publish(tenantId, "channel.status", { id: row.channelConnectionId, status: "CONNECTED", provider: "EMAIL" });
      } finally { lock.release(); }
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 240) : "Falha na sincronização da caixa.";
      await this.prisma.$transaction([
        this.prisma.emailMailbox.update({ where: { id: row.id }, data: { status: "ERROR", lastError: detail } }),
        this.prisma.channelConnection.update({ where: { id: row.channelConnectionId }, data: { status: "ERROR", lastError: detail } }),
      ]);
      this.events.publish(tenantId, "channel.status", { id: row.channelConnectionId, status: "ERROR", provider: "EMAIL", lastError: detail });
      this.logger.warn("Falha ao sincronizar mailbox " + row.id + ": " + detail);
      throw new BadGatewayException("Não foi possível sincronizar a caixa de e-mail.");
    } finally { await client.logout().catch(() => client.close()); }
    return { imported, skipped };
  }

  async send(tenantId: string, conversationId: string, text: string, userId: string, attachment?: EmailAttachment) {
    if (typeof text !== "string" || text.length > MAX_MESSAGE_TEXT || (!text.trim() && !attachment)) throw new BadRequestException("Mensagem de e-mail inválida.");
    if (attachment) {
      if (typeof attachment.filename !== "string" || !attachment.filename.trim() || attachment.filename.length > 255) throw new BadRequestException("Nome do anexo inválido.");
      if (typeof attachment.contentType !== "string" || !/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(attachment.contentType)) throw new BadRequestException("Tipo do anexo inválido.");
      if (typeof attachment.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.data)) throw new BadRequestException("Conteúdo do anexo inválido.");
      const decodedSize = Math.floor(attachment.data.length * 3 / 4) - (attachment.data.endsWith("==") ? 2 : attachment.data.endsWith("=") ? 1 : 0);
      if (decodedSize <= 0 || decodedSize > MAX_OUTBOUND_ATTACHMENT_BYTES) throw new BadRequestException("O anexo excede o limite de 16 MB.");
    }
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId, channel: "EMAIL" }, include: { contact: true, channelConnection: { include: { emailMailbox: true } } } });
    if (!conversation?.channelConnection?.emailMailbox) throw new NotFoundException("Inbox de e-mail não encontrada para esta conversa.");
    const mailbox = conversation.channelConnection.emailMailbox;
    if (!mailbox.smtpHost || !mailbox.smtpUser || (mailbox.authMode === "PASSWORD" && !mailbox.smtpPasswordEncrypted) || !mailbox.smtpFrom) throw new ServiceUnavailableException("SMTP de resposta não configurado para esta caixa.");
    const smtpEndpoint = await mailHost(mailbox.smtpHost);
    const auth = await this.auth(mailbox);
    const transport = new SmtpMailTransport({ host: smtpEndpoint, tlsServername: mailbox.smtpHost, port: mailbox.smtpPort || 587, secure: mailbox.smtpSecure === true, user: auth.user, ...(auth.pass ? { password: auth.pass } : {}), ...(auth.accessToken ? { accessToken: auth.accessToken } : {}), from: mailbox.smtpFrom, fromName: mailbox.smtpFromName || undefined });
    const subject = conversation.subject?.startsWith("Re:") ? conversation.subject : "Re: " + (conversation.subject || "(sem assunto)");
    let result: Awaited<ReturnType<SmtpMailTransport["send"]>>;
    try {
      result = await transport.send({ to: conversation.contact.email || "", subject, text: text.trim() || "Arquivo anexado: " + attachment!.filename, replyTo: mailbox.address, ...(attachment ? { attachments: [{ filename: attachment.filename, content: Buffer.from(attachment.data, "base64"), contentType: attachment.contentType }] } : {}) });
    } finally {
      transport.close();
    }
    if (!result.delivered) throw new BadGatewayException(result.reason || "O servidor SMTP não aceitou a resposta.");
    const message = await this.prisma.message.create({ data: { tenantId, conversationId, providerMessageId: result.providerId || null, direction: "OUTBOUND", status: "SENT", content: text.trim() || "[Anexo] " + attachment!.filename, contentType: attachment ? "file" : "text", senderName: mailbox.smtpFrom, metadata: { provider: "EMAIL", mailboxId: mailbox.id, replyTo: conversation.contact.email, senderUserId: userId, ...(attachment ? { attachment: { filename: attachment.filename, contentType: attachment.contentType, size: Math.floor(attachment.data.length * 3 / 4) } } : {}) }, occurredAt: new Date() } });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.occurredAt, status: "OPEN" } });
    this.events.publish(tenantId, "message.sent", { conversationId, message: { id: message.id, direction: message.direction, status: message.status, content: message.content, occurredAt: message.occurredAt.toISOString(), channel: "EMAIL" } });
    return message;
  }
}

