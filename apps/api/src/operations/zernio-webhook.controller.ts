import { Controller, ForbiddenException, Logger, NotFoundException, Param, ParseUUIDPipe, Post, RawBodyRequest, Req } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { ZernioService } from "./zernio.service";

type JsonObject = Record<string, any>;

@Controller("webhooks/zernio")
export class ZernioWebhookController {
  private readonly logger = new Logger(ZernioWebhookController.name);

  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly zernio: ZernioService) {}

  @Post(":channelId")
  async receive(@Param("channelId", ParseUUIDPipe) channelId: string, @Req() request: RawBodyRequest<Request>) {
    const channel = await this.prisma.channelConnection.findFirst({ where: { id: channelId, provider: "ZERNIO", isActive: true } });
    if (!channel) throw new NotFoundException("Conexão Zernio não encontrada.");
    const settings = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings) ? channel.settings as JsonObject : {};
    if (!this.zernio.verifyWebhook(request.rawBody, request.headers["x-zernio-signature"] as string | undefined, String(settings.webhookSecret || ""))) {
      this.logger.warn("Webhook Zernio recusado: assinatura inválida.");
      throw new ForbiddenException("Assinatura do webhook inválida.");
    }

    const body = request.body && typeof request.body === "object" ? request.body as JsonObject : {};
    if (body.test) {
      const updatedSettings = { ...settings, webhookVerifiedAt: new Date().toISOString() };
      await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { settings: updatedSettings } });
      this.events.publish(channel.tenantId, "channel.webhook_verified", { id: channel.id });
      return { ok: true, test: true };
    }
    const event = typeof body.event === "string" ? body.event : "";
    const accountId = String(body.account?.accountId || body.accountId || "");
    if (accountId !== String(settings.accountId || "")) return { ok: true, ignored: true };
    if (channel.status !== "CONNECTED" || !settings.webhookVerifiedAt) {
      await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status: "CONNECTED", lastError: null, settings: { ...settings, webhookVerifiedAt: settings.webhookVerifiedAt || new Date().toISOString() } } });
      this.events.publish(channel.tenantId, "channel.status", { id: channel.id, status: "CONNECTED" });
    }

    if (event === "message.received") {
      const message = body.message && typeof body.message === "object" ? body.message as JsonObject : {};
      const sender = message.sender || body.sender || {};
      const externalConversationId = String(message.conversationId || body.conversation?.id || "");
      const externalId = String(sender.phoneNumber || sender.id || "");
      if (!externalConversationId || !externalId) return { ok: true, ignored: true };
      const providerMessageId = String(message.platformMessageId || message.id || body.id || "");
      if (!providerMessageId) return { ok: true, ignored: true };
      const name = String(sender.name || sender.displayName || sender.fullName || sender.profileName || sender.username || externalId).trim().slice(0, 160);
      const text = String(message.text || message.metadata?.postbackPayload || message.metadata?.interactiveId || "").slice(0, 20000);
      const platform = String(settings.platform || "SOCIAL").toUpperCase();
      try {
        const saved = await this.prisma.$transaction(async (tx) => {
          const duplicate = await tx.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId }, select: { id: true } });
          if (duplicate) return null;
          let contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, externalId } });
          const avatar = sender.picture || sender.profilePictureUrl || sender.profilePicture || sender.avatarUrl || sender.profileImageUrl || sender.profile?.picture || sender.profile?.avatarUrl;
          const avatarMetadata = typeof avatar === "string" && /^https:\/\//i.test(avatar) ? { avatarUrl: avatar } : {};
          if (!contact) {
            contact = await tx.contact.create({ data: { tenantId: channel.tenantId, name, externalId, source: platform, metadata: { provider: "ZERNIO", accountId, externalConversationId, platform, ...avatarMetadata } } });
          } else {
            const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as JsonObject : {};
            contact = await tx.contact.update({ where: { id: contact.id }, data: { metadata: { ...metadata, provider: "ZERNIO", accountId, externalConversationId, platform, ...avatarMetadata }, ...((name !== externalId && (!contact.name || contact.name === contact.externalId || /^\d{6,}$/.test(contact.name))) ? { name } : {}) } });
          }
          let conversation = await tx.conversation.findFirst({ where: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, status: { in: ["OPEN", "PENDING"] } }, orderBy: { updatedAt: "desc" } });
          if (!conversation) conversation = await tx.conversation.create({ data: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, channel: platform, status: "OPEN" } });
          const created = await tx.message.create({ data: { tenantId: channel.tenantId, conversationId: conversation.id, providerMessageId, direction: "INBOUND", status: "RECEIVED", content: text, contentType: Array.isArray(message.attachments) && message.attachments.length ? "file" : "text", senderName: name, metadata: { provider: "ZERNIO", externalConversationId, platform, attachments: Array.isArray(message.attachments) ? message.attachments : [] } } });
          await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: created.occurredAt } });
          return { contactId: contact.id, conversationId: conversation.id, message: created };
        });
        if (saved) {
          this.events.publish(channel.tenantId, "message.received", { conversationId: saved.conversationId, contactId: saved.contactId, message: saved.message });
          this.events.publish(channel.tenantId, "conversation.updated", { id: saved.conversationId });
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
