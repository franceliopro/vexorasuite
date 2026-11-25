import {
  Body,
  BadRequestException,
  Controller,
  ForbiddenException,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { resolveContactIdentity } from "./contact-identity";
import { inboundKind } from "./inbound-kind";
import { normalizeInboundMedia } from "./inbound-media";
import { IntelligenceRuntimeService } from "./intelligence-runtime.service";
import { MetaService } from "./meta.service";
import { metaAppSecretFor, metaVerifyTokenFor } from "./meta-credentials";
import type { ChannelConnection } from "../generated/prisma/client";

const trim = (value: unknown, max = 20000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

/**
 * Webhook do WhatsApp Oficial (Meta Cloud API).
 *
 * Um GET atende a verificação da Meta no painel ("hub.mode=subscribe" + challenge).
 * O POST valida a assinatura x-hub-signature-256 (HMAC-SHA256 do corpo com o App Secret),
 * bloqueia qualquer requisição não assinada e ingere texto e mídia como conversas —
 * o mesmo caminho do canal WAHA, isolado no provider "META".
 *
 * Mídia: aceita (contentType correto) com pré-visualização de legenda; o arquivo em si
 * fica na Meta por URL assinada de curta duração (v1 não faz download — o atendente abre
 * pelo WhatsApp). v2 fará o download interno para exibir na conversa.
 */
@Controller("webhooks/meta")
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaService,
    private readonly events: EventsService,
    private readonly intelligence: IntelligenceRuntimeService,
  ) {}

  private async channelFor(channelId: string) {
    const channel = await this.prisma.channelConnection.findFirst({
      where: { id: channelId, provider: "META", isActive: true },
    });
    if (!channel) return null;
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: channel.tenantId }, select: { integrations: true } });
    return { channel, integrations: object(tenant.integrations) };
  }

  @Get(":channelId")
  async verify(
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
    @Res() res?: Response,
  ) {
    const found = await this.channelFor(channelId);
    if (!found) throw new NotFoundException("Canal do WhatsApp Oficial não encontrado.");
    const expected = metaVerifyTokenFor(found.integrations, found.channel.tenantId);
    if (!expected || trim(token, 200) !== expected) {
      throw new ForbiddenException("Token de verificação do webhook inválido.");
    }
    if (mode !== "subscribe" || !challenge) {
      throw new BadRequestException("Modo ou challenge ausente.");
    }
    res!.setHeader("content-type", "text/plain; charset=utf-8");
    res!.send(String(challenge));
    return;
  }

  @Post(":channelId")
  async receive(
    @Param("channelId", ParseUUIDPipe) channelId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    const found = await this.channelFor(channelId);
    if (!found) throw new NotFoundException("Canal do WhatsApp Oficial não encontrado.");
    const secret = metaAppSecretFor(found.integrations, found.channel.tenantId);
    if (!secret) {
      throw new ForbiddenException("Configure o App Secret do WhatsApp Oficial em Conexões.");
    }
    const raw: Buffer | undefined = req?.rawBody;
    const signature = typeof req?.headers?.["x-hub-signature-256"] === "string" ? req.headers["x-hub-signature-256"] : "";
    if (!raw || !signature) throw new ForbiddenException("Assinatura do webhook ausente.");
    const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    if (signature !== expected) {
      this.logger.warn(`Webhook Meta rejeitado: assinatura inválida para canal ${channelId}`);
      throw new ForbiddenException("Assinatura do webhook inválida.");
    }

    const root = object(body);
    const entries = Array.isArray(root.entry) ? root.entry : [];
    const phoneNumberId = typeof entries[0]?.changes?.[0]?.value?.metadata?.phone_number_id === "string"
      ? entries[0].changes[0].value.metadata.phone_number_id
      : null;
    const channelSettings = object(found.channel.settings);
    const ownedPhoneNumberId = typeof channelSettings.phoneNumberId === "string" ? channelSettings.phoneNumberId : null;
    if (!phoneNumberId || (ownedPhoneNumberId && phoneNumberId !== ownedPhoneNumberId)) {
      return { ok: true, ignored: true };
    }

    for (const entry of entries) {
      for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
        if (change?.field !== "messages") continue;
        const value = object(change?.value);
        try {
          await this.applyStatuses(found.channel, value);
          await this.ingestMessages(found.channel, value);
        } catch (error) {
          this.logger.error(`Webhook Meta: falha ao processar lote em ${channelId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return { ok: true };
  }

  private async applyStatuses(channel: ChannelConnection, value: Record<string, any>) {
    const tenantId = channel.tenantId;
    const statuses = Array.isArray(value.statuses) ? value.statuses : [];
    for (const item of statuses) {
      const wamid = trim(item?.id, 120);
      const status = String(item?.status ?? "").toLowerCase();
      const prev: Record<string, string[]> = { sent: ["QUEUED"], delivered: ["QUEUED", "SENT"], read: ["QUEUED", "SENT", "DELIVERED"] };
      const next: Record<string, string> = { sent: "SENT", delivered: "DELIVERED", read: "READ" };
      if (!wamid || !prev[status] || !next[status]) continue;
      const message = await this.prisma.message.findFirst({ where: { tenantId, providerMessageId: wamid }, select: { id: true, conversationId: true, status: true } });
      if (!message) continue;
      const updated = await this.prisma.message.updateMany({
        where: { id: message.id, status: { in: prev[status] } as any },
        data: { status: next[status] as any },
      });
      if (updated.count) {
        this.events.publish(tenantId, "message.status", { conversationId: message.conversationId, messageId: message.id, status: next[status] });
      }
    }
  }

  private async ingestMessages(channel: ChannelConnection, value: Record<string, any>) {
    const tenantId = channel.tenantId;
    const runtimeIntegrations = object((await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { integrations: true } })).integrations);
    const runtimePublications = object(runtimeIntegrations.intelligencePublications);
    const companyPublication = object(runtimeIntegrations.intelligencePublished);
    const intelligenceEnabled = companyPublication.active === true || Object.values(runtimePublications).some((publication: any) => publication?.active === true);

    const notifyName = (Array.isArray(value.contacts) ? value.contacts : [])
      .map((contact: any) => trim(contact?.profile?.name, 160))
      .find((name: string) => Boolean(name)) || "";

    for (const msg of Array.isArray(value.messages) ? value.messages : []) {
      const wamid = trim(msg?.id, 120);
      const from = String(msg?.from ?? "").replace(/\D/g, "");
      if (!wamid || !from) continue;
      const type = String(msg?.type ?? "text").toLowerCase();
      if (type === "system") continue;
      const content = (() => {
        if (type === "text") return trim(msg?.text?.body) || "";
        if (type === "image") return trim(msg?.image?.caption) || "Imagem recebida";
        if (type === "video") return trim(msg?.video?.caption) || "Vídeo recebido";
        if (type === "audio" || type === "voice") return "Áudio recebido";
        if (type === "document") return trim(msg?.document?.filename, 200) || "Documento recebido";
        if (type === "sticker") return "Figurinha recebida";
        if (type === "location") return "Localização recebida";
        if (type === "contacts") return "Contato recebido";
        return "Anexo recebido";
      })();
      const contentType = inboundKind({ type, media: { mimetype: this.mimeOf(msg) }, hasMedia: type !== "text" });
      const mimeType = this.mimeOf(msg);
      const filename = type === "document" ? trim(msg?.document?.filename, 255) || null : null;
      // A Meta entrega apenas um id de mídia; nunca guardamos a URL assinada do webhook.
      const mediaId = trim(msg?.[type]?.id ?? (type === "voice" ? msg?.voice?.id : undefined), 255);
      const chatId = from;
      const occurredAt = (() => {
        const seconds = Number(msg?.timestamp);
        return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
      })();
      try {
        const saved = await this.persistInbound(channel, {
          tenantId,
          chatId,
          phone: from,
          providerMessageId: wamid,
          notifyName,
          content,
          contentType,
          mimeType,
          filename,
          mediaId,
          occurredAt,
          intelligenceEnabled,
        });
        if (!saved) continue; // duplicado — segue para a próxima mensagem do lote
        this.events.publish(tenantId, "message.received", { conversationId: saved.conversationId, contactId: saved.contactId, message: saved.message });
        this.events.publish(tenantId, "conversation.updated", { id: saved.conversationId, lastMessageAt: saved.message.occurredAt.toISOString() });
        if (saved.handlingMode === "BOT") {
          void this.meta.markSeen(tenantId, this.phoneNumberIdOf(channel), wamid).catch(() => undefined);
        }
        if (saved.handlingMode === "BOT" && intelligenceEnabled) continue;
        if (saved.handlingMode === "BOT") {
          await this.intelligence.receive(channel, saved.conversationId, saved.message.id);
        }
      } catch (error) {
        this.logger.error(`Falha ao processar mensagem Meta ${wamid} em ${tenantId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private mimeOf(msg: Record<string, any>): string {
    const anyMsg = msg as any;
    if (anyMsg.type === "document") return trim(anyMsg.document?.mime_type ?? "", 120);
    if (anyMsg.type === "audio") return trim(anyMsg.audio?.mime_type ?? "", 120);
    if (anyMsg.type === "voice") return trim(anyMsg.voice?.mime_type ?? "", 120);
    if (anyMsg.type === "image") return trim(anyMsg.image?.mime_type ?? "", 120);
    if (anyMsg.type === "video") return trim(anyMsg.video?.mime_type ?? "", 120);
    if (anyMsg.type === "sticker") return trim(anyMsg.sticker?.mime_type ?? "", 120);
    return "";
  }

  private phoneNumberIdOf(channel: ChannelConnection): string {
    const settings = object(channel.settings);
    const id = typeof settings.phoneNumberId === "string" ? settings.phoneNumberId : "";
    if (!id) throw new Error("Canal Meta sem phoneNumberId configurado.");
    return id;
  }

  private async persistInbound(channel: ChannelConnection, input: {
    tenantId: string;
    chatId: string;
    phone: string;
    providerMessageId: string;
    notifyName: string;
    content: string;
    contentType: "text" | "audio" | "image" | "video" | "file";
    mimeType: string;
    filename: string | null;
    mediaId: string;
    occurredAt: Date;
    intelligenceEnabled: boolean;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockKey = `${input.tenantId}:inbound:${input.chatId}`;
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const duplicate = await tx.message.findFirst({ where: { tenantId: input.tenantId, providerMessageId: input.providerMessageId }, select: { id: true } });
        if (duplicate) return null;

        let contact = await resolveContactIdentity(tx as any, {
          tenantId: input.tenantId,
          provider: "META",
          externalId: input.chatId,
          phone: input.phone,
          displayName: input.notifyName || null,
          metadata: { provider: "META", channelConnectionId: channel.id, isGroup: false },
          createContact: { name: input.notifyName || input.phone, source: "WhatsApp" },
        } as any);
        if (contact && input.notifyName && (!contact.name || contact.name === contact.phone || contact.name === contact.externalId)) {
          contact = await tx.contact.update({ where: { id: contact.id }, data: { name: input.notifyName } });
        }
        if (!contact) throw new Error("Não foi possível resolver a identidade do contato.");

        let conversation = await tx.conversation.findFirst({
          where: { tenantId: input.tenantId, contactId: contact.id, channelConnectionId: channel.id, status: { in: ["OPEN", "PENDING"] }, archivedAt: null, deletedAt: null },
          orderBy: { updatedAt: "desc" },
        });
        if (!conversation) {
          conversation = await tx.conversation.create({
            data: { tenantId: input.tenantId, contactId: contact.id, channelConnectionId: channel.id, channel: "WHATSAPP", status: "OPEN" },
          });
        }
        const media = normalizeInboundMedia({ provider: "META", type: input.contentType, hasMedia: input.contentType !== "text", mimetype: input.mimeType, filename: input.filename ?? undefined, mediaId: input.mediaId });
        const metadata = {
          provider: "META",
          chatId: input.chatId,
          isGroup: false,
          ...media,
          mimeType: media.mimetype,
          ...(input.intelligenceEnabled && conversation.handlingMode === "BOT" ? { engineStatus: "PENDING", engineAttempts: 0 } : {}),
        };
        const message = await tx.message.create({
          data: {
            tenantId: input.tenantId,
            conversationId: conversation.id,
            providerMessageId: input.providerMessageId,
            direction: "INBOUND",
            status: "RECEIVED",
            content: input.content,
            contentType: input.contentType,
            senderName: input.notifyName || null,
            metadata: metadata as any,
            occurredAt: input.occurredAt,
          },
        });
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.occurredAt } });
        return {
          contactId: contact.id,
          conversationId: conversation.id,
          handlingMode: conversation.handlingMode,
          message: { id: message.id, content: message.content, contentType: message.contentType, status: message.status, direction: message.direction, occurredAt: message.occurredAt },
        };
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return null;
      throw error;
    }
  }
}
