import { Body, Controller, ForbiddenException, NotFoundException, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { WahaService } from "./waha.service";

@Controller("webhooks/waha")
export class WahaWebhookController {
  constructor(private readonly prisma: PrismaService, private readonly waha: WahaService, private readonly events: EventsService) {}

  @Post(":channelId/:token")
  async receive(@Param("channelId", ParseUUIDPipe) channelId: string, @Param("token") token: string, @Body() body: unknown) {
    if (!this.waha.verifyWebhookToken(channelId, token)) throw new ForbiddenException("Assinatura do webhook inválida.");
    const channel = await this.prisma.channelConnection.findFirst({ where: { id: channelId, provider: "WAHA", isActive: true } });
    if (!channel) throw new NotFoundException("Canal não encontrado.");

    const envelope = body && typeof body === "object" ? body as Record<string, any> : {};
    if (envelope.session && envelope.session !== channel.sessionName) return { ok: true, ignored: true };
    const payload = envelope.payload && typeof envelope.payload === "object" ? envelope.payload as Record<string, any> : {};

    if (envelope.event === "message.ack") {
      if (payload.fromMe === false) return { ok: true, ignored: true };
      const providerMessageId = this.providerMessageId(payload.id);
      const ack = Number(payload.ack);
      const status = ack >= 3 ? "READ" : ack === 2 ? "DELIVERED" : ack === 1 ? "SENT" : null;
      if (!providerMessageId || !status) return { ok: true, ignored: true };
      const message = await this.prisma.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId }, include: { conversation: { select: { id: true, channelConnectionId: true } } } });
      if (!message || message.conversation.channelConnectionId !== channel.id) return { ok: true, ignored: true };
      const updated = await this.prisma.message.update({ where: { id: message.id }, data: { status } });
      this.events.publish(channel.tenantId, "message.status", { conversationId: message.conversationId, messageId: updated.id, status: updated.status });
      return { ok: true };
    }

    if (envelope.event !== "message" || payload.fromMe === true) return { ok: true, ignored: true };
    const rawFrom = typeof payload.from === "string" ? payload.from.trim() : "";
    if (!rawFrom || rawFrom.includes("@g.us") || rawFrom === "status@broadcast") return { ok: true, ignored: true };
    const chatId = rawFrom.includes("@") ? rawFrom : `${rawFrom}@c.us`;
    const providerMessageId = this.providerMessageId(payload.id);
    if (!providerMessageId) return { ok: true, ignored: true };

    const phone = chatId.endsWith("@c.us") ? chatId.slice(0, -5).replace(/\D/g, "") || null : null;
    const notifyName = String(payload._data?.notifyName || payload.pushName || "").trim().slice(0, 160);
    const content = typeof payload.body === "string" ? payload.body.slice(0, 20000) : "";
    const mimeType = String(payload.media?.mimetype || "");
    const contentType = payload.hasMedia ? mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("video/") ? "video" : "file" : "text";
    const timestamp = Number(payload.timestamp);
    const occurredAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp < 1000000000000 ? timestamp * 1000 : timestamp) : new Date();

    let saved: { contactId: string; conversationId: string; message: { id: string; content: string; contentType: string; status: string; direction: string; occurredAt: Date } } | null;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        const lockKey = `${channel.tenantId}:inbound:${chatId}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const duplicate = await tx.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId }, select: { id: true } });
        if (duplicate) return null;

        let contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, externalId: chatId } });
        if (!contact && phone) contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, phone } });
        if (!contact) {
          contact = await tx.contact.create({
            data: { tenantId: channel.tenantId, name: notifyName || phone || chatId, phone, externalId: chatId, source: "WhatsApp", metadata: { provider: "WAHA", channelConnectionId: channel.id } },
          });
        } else {
          const update: { name?: string; phone?: string; externalId?: string } = {};
          if (notifyName && (!contact.name || contact.name === contact.phone || contact.name === contact.externalId)) update.name = notifyName;
          if (phone && !contact.phone) update.phone = phone;
          if (!contact.externalId) update.externalId = chatId;
          if (Object.keys(update).length) contact = await tx.contact.update({ where: { id: contact.id }, data: update });
        }

        let conversation = await tx.conversation.findFirst({
          where: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, status: { in: ["OPEN", "PENDING"] } },
          orderBy: { updatedAt: "desc" },
        });
        if (!conversation) {
          conversation = await tx.conversation.create({ data: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, channel: "WHATSAPP", status: "OPEN" } });
        }

        const metadata = { provider: "WAHA", session: channel.sessionName, chatId, hasMedia: Boolean(payload.hasMedia), mimeType: mimeType || null, filename: payload.media?.filename ? String(payload.media.filename).slice(0, 255) : null };
        const message = await tx.message.create({
          data: { tenantId: channel.tenantId, conversationId: conversation.id, providerMessageId, direction: "INBOUND", status: "RECEIVED", content, contentType, senderName: notifyName || null, metadata, occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt },
        });
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.occurredAt } });
        return { contactId: contact.id, conversationId: conversation.id, message: { id: message.id, content: message.content, contentType: message.contentType, status: message.status, direction: message.direction, occurredAt: message.occurredAt } };
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return { ok: true, duplicate: true };
      throw error;
    }

    if (!saved) return { ok: true, duplicate: true };
    this.events.publish(channel.tenantId, "message.received", { conversationId: saved.conversationId, contactId: saved.contactId, message: saved.message });
    this.events.publish(channel.tenantId, "conversation.updated", { id: saved.conversationId, lastMessageAt: saved.message.occurredAt.toISOString() });
    return { ok: true };
  }

  private providerMessageId(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "_serialized" in value) {
      const serialized = (value as { _serialized?: unknown })._serialized;
      return typeof serialized === "string" ? serialized : null;
    }
    return null;
  }
}
