import { Body, Controller, ForbiddenException, Logger, NotFoundException, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { ChannelConnection } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { WahaService } from "./waha.service";

@Controller("webhooks/waha")
export class WahaWebhookController {
  private readonly logger = new Logger(WahaWebhookController.name);

  constructor(private readonly prisma: PrismaService, private readonly waha: WahaService, private readonly events: EventsService) {}

  @Post(":channelId/:token")
  async receive(@Param("channelId", ParseUUIDPipe) channelId: string, @Param("token") token: string, @Body() body: unknown) {
    if (!this.waha.verifyWebhookToken(channelId, token)) {
      this.logger.warn(`Webhook rejeitado: token inválido para canal ${channelId}`);
      throw new ForbiddenException("Assinatura do webhook inválida.");
    }
    const channel = await this.prisma.channelConnection.findFirst({ where: { id: channelId, provider: "WAHA", isActive: true } });
    if (!channel) throw new NotFoundException("Canal não encontrado.");

    const envelope = body && typeof body === "object" ? body as Record<string, any> : {};
    this.logger.log(`Webhook recebido: canal=${channelId} evento=${String(envelope.event || "desconhecido")} sessão=${String(envelope.session || "ausente")}`);
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
    if (!rawFrom || rawFrom === "status@broadcast") return { ok: true, ignored: true };
    const isGroup = rawFrom.endsWith("@g.us");
    if (isGroup) {
      const settings = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings)
        ? channel.settings as Record<string, unknown> : {};
      const allowedGroupIds = Array.isArray(settings.allowedGroupIds)
        ? settings.allowedGroupIds.filter((value): value is string => typeof value === "string") : [];
      // Group traffic is opt-in and allowlist-only. Enabling groups without selecting IDs still receives none.
      if (settings.groupsEnabled !== true || !allowedGroupIds.includes(rawFrom)) {
        return { ok: true, ignored: true, reason: "GROUP_NOT_ALLOWED" };
      }
    }
    const chatId = rawFrom.includes("@") ? rawFrom : `${rawFrom}@c.us`;
    const providerMessageId = this.providerMessageId(payload.id);
    if (!providerMessageId) return { ok: true, ignored: true };

    const phone = !isGroup && chatId.endsWith("@c.us") ? chatId.slice(0, -5).replace(/\D/g, "") || null : null;
    const notifyName = String((isGroup ? payload._data?.chat?.name || payload._data?.groupMetadata?.subject : null) || payload._data?.notifyName || payload.pushName || "").trim().slice(0, 160);
    const content = typeof payload.body === "string" ? payload.body.slice(0, 20000) : "";
    const mimeType = String(payload.media?.mimetype || "");
    const contentType = payload.hasMedia ? mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("video/") ? "video" : "file" : "text";
    const timestamp = Number(payload.timestamp);
    const occurredAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp < 1000000000000 ? timestamp * 1000 : timestamp) : new Date();

    let saved: { contactId: string; conversationId: string; isNewConversation: boolean; handlingMode: "BOT" | "HUMAN"; message: { id: string; content: string; contentType: string; status: string; direction: string; occurredAt: Date } } | null;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        const lockKey = `${channel.tenantId}:inbound:${chatId}`;
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const duplicate = await tx.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId }, select: { id: true } });
        if (duplicate) return null;

        let contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, externalId: chatId } });
        if (!contact && phone) contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, phone } });
        if (!contact) {
          contact = await tx.contact.create({
            data: { tenantId: channel.tenantId, name: notifyName || (isGroup ? `Grupo ${chatId}` : phone || chatId), phone, externalId: chatId, source: "WhatsApp", metadata: { provider: "WAHA", channelConnectionId: channel.id, isGroup } },
          });
        } else {
          const update: { name?: string; phone?: string; externalId?: string } = {};
          if (notifyName && (!contact.name || contact.name === contact.phone || contact.name === contact.externalId)) update.name = notifyName;
          if (phone && !contact.phone) update.phone = phone;
          if (!contact.externalId) update.externalId = chatId;
          if (Object.keys(update).length) contact = await tx.contact.update({ where: { id: contact.id }, data: update });
        }

        let isNewConversation = false;\n        let conversation = await tx.conversation.findFirst({
          where: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, status: { in: ["OPEN", "PENDING"] } },
          orderBy: { updatedAt: "desc" },
        });
        if (!conversation) {
          conversation = await tx.conversation.create({ data: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, channel: "WHATSAPP", status: "OPEN" } });
        }

        const metadata = { provider: "WAHA", session: channel.sessionName, chatId, isGroup, hasMedia: Boolean(payload.hasMedia), mimeType: mimeType || null, filename: payload.media?.filename ? String(payload.media.filename).slice(0, 255) : null };
        const message = await tx.message.create({
          data: { tenantId: channel.tenantId, conversationId: conversation.id, providerMessageId, direction: "INBOUND", status: "RECEIVED", content, contentType, senderName: notifyName || null, metadata, occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt },
        });
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.occurredAt } });
        return { contactId: contact.id, conversationId: conversation.id, isNewConversation, handlingMode: conversation.handlingMode, message: { id: message.id, content: message.content, contentType: message.contentType, status: message.status, direction: message.direction, occurredAt: message.occurredAt } };
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return { ok: true, duplicate: true };
      throw error;
    }

    if (!saved) return { ok: true, duplicate: true };
    this.logger.log(`Mensagem recebida e gravada: canal=${channelId} conversa=${saved.conversationId} tipo=${contentType}`);
    this.events.publish(channel.tenantId, "message.received", { conversationId: saved.conversationId, contactId: saved.contactId, message: saved.message });
    this.events.publish(channel.tenantId, "conversation.updated", { id: saved.conversationId, lastMessageAt: saved.message.occurredAt.toISOString() });
    return { ok: true };
  }


  private async runMenuBot(channel: ChannelConnection, chatId: string, conversationId: string, isNewConversation: boolean, inboundText: string): Promise<void> {
    const defaults = [
      { key: "FINANCEIRO", name: "Financeiro", keywords: ["boleto", "pagamento", "fatura", "nota fiscal", "reembolso", "cobrança", "cobranca", "financeiro"] },
      { key: "COMERCIAL", name: "Comercial (Vendas)", keywords: ["preço", "preco", "orçamento", "orcamento", "comprar", "venda", "vendas", "plano", "comercial"] },
      { key: "SUPORTE", name: "Suporte", keywords: ["problema", "erro", "ajuda", "suporte", "não funciona", "nao funciona", "suporte técnico", "suporte tecnico"] },
      { key: "ADMINISTRATIVO", name: "Administrativo", keywords: ["documento", "contrato", "cadastro", "administrativo"] },
    ];
    try {
      for (const department of defaults) {
        await this.prisma.department.upsert({
          where: { tenantId_key: { tenantId: channel.tenantId, key: department.key } },
          create: { tenantId: channel.tenantId, ...department },
          update: {},
        });
      }
      const departments = await this.prisma.department.findMany({ where: { tenantId: channel.tenantId, isActive: true } });
      const normalized = inboundText.trim().toLocaleLowerCase("pt-BR");
      const byNumber: Record<string, string> = { "1": "FINANCEIRO", "2": "COMERCIAL", "3": "SUPORTE", "4": "ADMINISTRATIVO" };
      const chosenKey = byNumber[normalized];
      const chosen = departments.find((department) => department.key === chosenKey)
        || departments.find((department) => normalized.length >= 3 && (
          normalized.includes(department.name.toLocaleLowerCase("pt-BR"))
          || department.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("pt-BR")))
        ));
      const menu = "Olá! Sou o assistente virtual. 😊\n\nPara encaminhar você à equipe certa, escolha uma opção:\n1️⃣ Financeiro\n2️⃣ Comercial / Vendas\n3️⃣ Suporte\n4️⃣ Administrativo\n\nVocê também pode escrever brevemente o que precisa, e eu tentarei identificar a área.";
      if (chosen) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { handlingMode: "HUMAN", departmentId: chosen.id, status: "OPEN" } });
        this.events.publish(channel.tenantId, "conversation.updated", { id: conversationId, handlingMode: "HUMAN", departmentId: chosen.id, status: "OPEN" });
        await this.sendBotReply(channel, chatId, conversationId, `Certo! Estou encaminhando sua conversa para **${chosen.name}**. Um atendente continuará o atendimento por aqui. 🙌`);
      } else if (isNewConversation || /\\b(menu|ajuda|atendente|humano|opções|opcoes)\\b/.test(normalized)) {
        await this.sendBotReply(channel, chatId, conversationId, menu);
      } else {
        await this.sendBotReply(channel, chatId, conversationId, "Ainda não consegui identificar a área. Por favor, escolha 1 (Financeiro), 2 (Comercial), 3 (Suporte) ou 4 (Administrativo).");
      }
    } catch (error) {
      this.logger.warn(`Bot inicial não conseguiu processar a conversa ${conversationId}: ${error instanceof Error ? error.message : "falha desconhecida"}`);
    }
  }

  private async sendBotReply(channel: { id: string; tenantId: string; sessionName: string } & Parameters<WahaService["sendText"]>[0], chatId: string, conversationId: string, content: string): Promise<void> {
    const queued = await this.prisma.message.create({
      data: { tenantId: channel.tenantId, conversationId, direction: "OUTBOUND", status: "QUEUED", content, contentType: "text", senderName: "Assistente virtual", metadata: { provider: "WAHA", bot: true } },
    });
    this.events.publish(channel.tenantId, "message.queued", { conversationId, message: { id: queued.id, direction: queued.direction, status: queued.status, content: queued.content } });
    try {
      const providerMessageId = await this.waha.sendText(channel, chatId, content);
      const sent = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "SENT", providerMessageId } });
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: sent.occurredAt } });
      this.events.publish(channel.tenantId, "message.sent", { conversationId, message: { id: sent.id, direction: sent.direction, status: sent.status, content: sent.content, occurredAt: sent.occurredAt.toISOString() } });
    } catch {
      const failed = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "FAILED", metadata: { provider: "WAHA", bot: true, errorCode: "BOT_SEND_FAILED" } } });
      this.events.publish(channel.tenantId, "message.failed", { conversationId, message: { id: failed.id, status: failed.status, content: failed.content } });
    }
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
