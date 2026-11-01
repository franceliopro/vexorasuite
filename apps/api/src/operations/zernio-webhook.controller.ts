import { socialUsername } from "./social-identity";
import { randomBytes } from "node:crypto";
import { IntelligenceRuntimeService } from "./intelligence-runtime.service";
import { Controller, ForbiddenException, Logger, NotFoundException, Param, ParseUUIDPipe, Post, RawBodyRequest, Req } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { ZernioService } from "./zernio.service";

const zernioProfileId = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return String(item.id ?? item._id ?? item.profileId ?? "");
  }
  return "";
};

type JsonObject = Record<string, any>;

@Controller("webhooks/zernio")
export class ZernioWebhookController {
  private readonly logger = new Logger(ZernioWebhookController.name);

  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly zernio: ZernioService, private readonly engine: IntelligenceRuntimeService) {}


  @Post("team")
  async receiveTeam(@Req() request: RawBodyRequest<Request>) {
    const secret = process.env.ZERNIO_WEBHOOK_SECRET || "";
    if (!this.zernio.verifyWebhook(request.rawBody, request.headers["x-zernio-signature"] as string | undefined, secret)) {
      this.logger.warn("Webhook central Zernio recusado: assinatura inválida.");
      throw new ForbiddenException("Assinatura do webhook central inválida.");
    }
    const body = request.body && typeof request.body === "object" ? request.body as JsonObject : {};
    if (body.test) return { ok: true, test: true };
    const event = typeof body.event === "string" ? body.event : "";
    const account = body.account && typeof body.account === "object" ? body.account as JsonObject : {};
    const accountId = String(account.accountId || account.id || body.accountId || "");
    const profileId = zernioProfileId(account.profileId || body.profileId);
    if (!accountId) return { ok: true, ignored: true };
    if (event === "account.connected" || event === "account.disconnected") {
      if (!profileId) return { ok: true, ignored: true };
      const profile = await this.prisma.zernioProfile.findUnique({ where: { profileId }, select: { tenantId: true, profileId: true } });
      if (!profile) return { ok: true, ignored: true };
      if (event === "account.disconnected") {
        const channel = await this.prisma.channelConnection.findFirst({ where: { tenantId: profile.tenantId, provider: "ZERNIO", isActive: true, settings: { path: ["accountId"], equals: accountId } } });
        const settings = channel?.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings) ? channel.settings as JsonObject : {};
        if (channel && settings.profileId === profileId) {
          await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status: "DISCONNECTED", lastError: "ZERNIO_ACCOUNT_DISCONNECTED" } });
          this.events.publish(profile.tenantId, "channel.status", { id: channel.id, status: "DISCONNECTED" });
        }
        return { ok: true, accepted: !!channel };
      }
      const platform = String(account.platform || "").toLowerCase();
      if (!platform) return { ok: true, ignored: true };
      const identity = { platform, accountId, profileId, username: socialUsername(account) || "", profileName: typeof account.profileName === "string" ? account.profileName : "", identityCheckedAt: new Date().toISOString() };
      const channel = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${accountId}, 0))`;
        const owner = await tx.channelConnection.findFirst({ where: { provider: "ZERNIO", isActive: true, settings: { path: ["accountId"], equals: accountId } } });
        if (owner && owner.tenantId !== profile.tenantId) throw new ForbiddenException("A conta já pertence a outra empresa.");
        const existing = await tx.channelConnection.findFirst({ where: { tenantId: profile.tenantId, provider: "ZERNIO", isActive: true, settings: { path: ["accountId"], equals: accountId } } });
        if (existing) return tx.channelConnection.update({ where: { id: existing.id }, data: { status: "CONNECTING", lastError: null, settings: { ...(existing.settings as JsonObject || {}), ...identity } } });
        return tx.channelConnection.create({ data: { tenantId: profile.tenantId, provider: "ZERNIO", name: String(account.name || account.username || platform).slice(0, 100), sessionName: "zn-" + profile.tenantId.replace(/-/g, "").slice(0, 10) + "-" + randomBytes(5).toString("hex"), status: "CONNECTING", settings: identity } });
      });
      this.events.publish(profile.tenantId, "channel.updated", { id: channel.id, provider: "ZERNIO", status: channel.status });
      return { ok: true, accepted: true };
    }
    const channel = await this.prisma.channelConnection.findFirst({ where: { provider: "ZERNIO", isActive: true, settings: { path: ["accountId"], equals: accountId } } });
    if (!channel) return { ok: true, ignored: true };
    const settings = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings) ? channel.settings as JsonObject : {};
    if (["ZERNIO_ACCOUNT_MISSING", "ZERNIO_ACCOUNT_CHANGED", "ZERNIO_ACCOUNT_DISCONNECTED"].includes(channel.lastError || "")) return { ok: true, ignored: true };
    const profile = await this.prisma.zernioProfile.findUnique({ where: { tenantId: channel.tenantId } });
    if (!profile || settings.profileId !== profile.profileId || (profileId && profileId !== profile.profileId)) return { ok: true, ignored: true };
    return this.processEvent(channel, { ...body, account: { ...account, accountId } });
  }

  @Post(":channelId")
  async receive(@Param("channelId", ParseUUIDPipe) channelId: string, @Req() request: RawBodyRequest<Request>) {
    const channel = await this.prisma.channelConnection.findFirst({ where: { id: channelId, provider: "ZERNIO", isActive: true } });
    if (!channel) throw new NotFoundException("Conexão Zernio não encontrada.");
    const settings = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings) ? channel.settings as JsonObject : {};
    if (!this.zernio.verifyWebhook(request.rawBody, request.headers["x-zernio-signature"] as string | undefined, String(settings.webhookSecret || ""))) {
      this.logger.warn("Webhook Zernio recusado: assinatura inválida.");
      throw new ForbiddenException("Assinatura do webhook inválida.");
    }
    if (["ZERNIO_ACCOUNT_MISSING", "ZERNIO_ACCOUNT_CHANGED", "ZERNIO_ACCOUNT_DISCONNECTED"].includes(channel.lastError || "")) return { ok: true, ignored: true };
    return this.processEvent(channel, request.body && typeof request.body === "object" ? request.body as JsonObject : {});
  }

  private async processEvent(channel: any, body: JsonObject) {
    const settings = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings) ? channel.settings as JsonObject : {};

    if (body.test) {
      const updatedSettings = { ...settings, webhookVerifiedAt: new Date().toISOString() };
      await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { settings: updatedSettings } });
      this.events.publish(channel.tenantId, "channel.webhook_verified", { id: channel.id });
      return { ok: true, test: true };
    }
    const event = typeof body.event === "string" ? body.event : "";
    const accountId = String(body.account?.accountId || body.accountId || settings.accountId || "");
    if (accountId !== String(settings.accountId || "")) return { ok: true, ignored: true };
    if (channel.status !== "CONNECTED" || !settings.webhookVerifiedAt) {
      await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status: "CONNECTED", lastError: null, settings: { ...settings, webhookVerifiedAt: settings.webhookVerifiedAt || new Date().toISOString() } } });
      this.events.publish(channel.tenantId, "channel.status", { id: channel.id, status: "CONNECTED" });
    }

    if (event === "message.received") {
      const message = body.message && typeof body.message === "object" ? body.message as JsonObject : {};
      const sender = message.sender || body.sender || {};
      const externalConversationId = String(message.conversationId || message.conversation?.id || body.conversation?.id || body.conversationId || body.threadId || body.chatId || "");
      const externalId = String(sender.phoneNumber || sender.id || sender.userId || sender.handle || sender.username || body.contact?.id || body.contact?.externalId || "");
      if (!externalConversationId || !externalId) return { ok: true, ignored: true };
      const providerMessageId = String(message.platformMessageId || message.providerMessageId || message.id || body.messageId || body.providerMessageId || body.id || "");
      if (!providerMessageId) return { ok: true, ignored: true };
      const name = String(sender.name || sender.displayName || sender.fullName || sender.profileName || sender.username || externalId).trim().slice(0, 160);
      // Never use the business account handle as the customer identity.
      const accountHandles = [settings.username, settings.profileName, channel.name].filter(Boolean).map(v => String(v).replace(/^@/, "").toLowerCase());
      const customerName = accountHandles.includes(name.replace(/^@/, "").toLowerCase()) ? externalId : name;
      const text = String(message.text || message.content || message.body || body.text || body.content || message.metadata?.postbackPayload || message.metadata?.interactiveId || "").slice(0, 20000);
      const platform = String(settings.platform || "SOCIAL").toUpperCase();
      try {
        const saved = await this.prisma.$transaction(async (tx) => {
          const duplicate = await tx.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId }, select: { id: true } });
          if (duplicate) return null;
          let contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, externalId } });
          const avatar = sender.profile_pic || sender.profile_picture_url || sender.picture?.data?.url || (typeof sender.picture === "string" ? sender.picture : undefined) || sender.profilePictureUrl || sender.profilePicture || sender.avatarUrl || sender.profileImageUrl || sender.profile?.picture || sender.profile?.avatarUrl;
          const avatarMetadata = typeof avatar === "string" && /^https:\/\//i.test(avatar) ? { avatarUrl: avatar } : {};
          if (!contact) {
            contact = await tx.contact.create({ data: { tenantId: channel.tenantId, name: customerName, externalId, source: platform, metadata: { provider: "ZERNIO", accountId, externalConversationId, platform, ...avatarMetadata } } });
          } else {
            const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as JsonObject : {};
            contact = await tx.contact.update({ where: { id: contact.id }, data: { metadata: { ...metadata, provider: "ZERNIO", accountId, externalConversationId, platform, ...avatarMetadata }, ...((customerName !== externalId && (!contact.name || contact.name === contact.externalId || /^\d{6,}$/.test(contact.name))) ? { name: customerName } : {}) } });
          }
          let conversation = await tx.conversation.findFirst({ where: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, status: { in: ["OPEN", "PENDING"] } }, orderBy: { updatedAt: "desc" } });
          if (!conversation) conversation = await tx.conversation.create({ data: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, channel: platform, status: "OPEN" } });
          const created = await tx.message.create({ data: { tenantId: channel.tenantId, conversationId: conversation.id, providerMessageId, direction: "INBOUND", status: "RECEIVED", content: text, contentType: Array.isArray(message.attachments) && message.attachments.length ? "file" : "text", senderName: customerName, metadata: { provider: "ZERNIO", externalConversationId, platform, attachments: Array.isArray(message.attachments) ? message.attachments : [] } } });
          await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: created.occurredAt } });
          return { contactId: contact.id, conversationId: conversation.id, message: created };
        });
        if (saved) {
          this.events.publish(channel.tenantId, "message.received", { conversationId: saved.conversationId, contactId: saved.contactId, message: saved.message });
          this.events.publish(channel.tenantId, "conversation.updated", { id: saved.conversationId });
          await this.engine.receive(channel, saved.conversationId, saved.message.id);
        }
        if (!saved) {
          const prior = await this.prisma.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId, direction: "INBOUND", conversation: { channelConnectionId: channel.id } } });
          if (prior) await this.engine.receive(channel, prior.conversationId, prior.id);
        }
        return { ok: true, duplicate: !saved };
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return { ok: true, duplicate: true };
        throw error;
      }
    }

    const supported = new Set(["comment.received", "reaction.received", "lead.received", "post.published", "keyword.received", "message.sent"]);
    if (!supported.has(event)) return { ok: true, ignored: true };
    const normalizedType = "social." + event;
    this.events.publish(channel.tenantId, normalizedType, { provider: "ZERNIO", accountId, platform: String(settings.platform || "SOCIAL"), eventId: String(body.id || body.eventId || ""), payload: body });
    return { ok: true, accepted: true, type: normalizedType };
  }
}
