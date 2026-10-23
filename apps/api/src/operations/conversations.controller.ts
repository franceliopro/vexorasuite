import { BadGatewayException, BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { WahaService } from "./waha.service";

@Controller("conversations")
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly waha: WahaService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("status") status?: string) {
    const allowed = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];
    const normalizedStatus = status?.toUpperCase();
    return this.prisma.conversation.findMany({
      where: { tenantId: request.user.tenantId, ...(normalizedStatus && allowed.includes(normalizedStatus) ? { status: normalizedStatus as "OPEN" | "PENDING" | "RESOLVED" | "CLOSED" } : {}) },
      include: { contact: { select: { id: true, name: true, phone: true, email: true } }, messages: { orderBy: { occurredAt: "desc" }, take: 1 } },
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 100,
    });
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() input: CreateConversationDto) {
    const tenantId = request.user.tenantId;
    const contact = await this.prisma.contact.findFirst({ where: { id: input.contactId, tenantId }, select: { id: true } });
    if (!contact) throw new NotFoundException("Contato não encontrado nesta empresa.");
    let channelConnectionId: string | undefined;
    if (input.channelConnectionId) {
      const channel = await this.prisma.channelConnection.findFirst({ where: { id: input.channelConnectionId, tenantId, isActive: true }, select: { id: true } });
      if (!channel) throw new NotFoundException("Canal não encontrado nesta empresa.");
      channelConnectionId = channel.id;
    } else if ((input.channel || "WHATSAPP").toUpperCase() === "WHATSAPP") {
      const channel = await this.prisma.channelConnection.findFirst({ where: { tenantId, provider: "WAHA", isActive: true }, orderBy: { createdAt: "desc" }, select: { id: true } });
      channelConnectionId = channel?.id;
    }
    const conversation = await this.prisma.conversation.create({
      data: { tenantId, contactId: contact.id, channel: input.channel?.trim().toUpperCase() || "WHATSAPP", ...(channelConnectionId ? { channelConnectionId } : {}) },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });
    this.events.publish(tenantId, "conversation.created", { id: conversation.id, contactId: conversation.contactId, status: conversation.status });
    return conversation;
  }

  @Get(":id/messages")
  async messages(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId: request.user.tenantId }, select: { id: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    return this.prisma.message.findMany({ where: { conversationId: conversation.id, tenantId: request.user.tenantId }, orderBy: { occurredAt: "asc" }, take: 500 });
  }

  @Post(":id/messages")
  async sendMessage(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: SendMessageDto) {
    const tenantId = request.user.tenantId;
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, include: { contact: true, channelConnection: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (conversation.status === "CLOSED") throw new BadRequestException("Esta conversa já foi encerrada.");
    if (!conversation.channelConnection || conversation.channelConnection.provider !== "WAHA" || !conversation.channelConnection.isActive) {
      throw new BadRequestException("Esta conversa não possui um canal WhatsApp conectado.");
    }
    const chatId = conversation.contact.externalId?.includes("@") ? conversation.contact.externalId
      : conversation.contact.phone ? `${conversation.contact.phone.replace(/\D/g, "")}@c.us` : conversation.contact.externalId;
    if (!chatId) throw new BadRequestException("O contato não possui um identificador WhatsApp válido.");
    const user = await this.prisma.user.findUnique({ where: { id: request.user.sub }, select: { name: true } });
    const content = input.content.trim();
    if (!content) throw new BadRequestException("Digite uma mensagem antes de enviar.");

    const queued = await this.prisma.message.create({ data: { tenantId, conversationId: conversation.id, direction: "OUTBOUND", status: "QUEUED", content, contentType: "text", senderName: user?.name || null, metadata: { provider: "WAHA" } } });
    this.events.publish(tenantId, "message.queued", { conversationId: conversation.id, message: { id: queued.id, direction: queued.direction, status: queued.status, content: queued.content } });
    let providerMessageId: string | null;
    try { providerMessageId = await this.waha.sendText(conversation.channelConnection, chatId, content); }
    catch {
      const failed = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "FAILED", metadata: { provider: "WAHA", errorCode: "SEND_FAILED" } } });
      this.events.publish(tenantId, "message.failed", { conversationId: conversation.id, message: { id: failed.id, status: failed.status, content: failed.content } });
      throw new BadGatewayException("A mensagem não foi enviada. A falha ficou registrada no histórico.");
    }
    const sent = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "SENT", providerMessageId } });
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: sent.occurredAt, ...(conversation.status === "RESOLVED" ? { status: "OPEN" } : {}) } });
    this.events.publish(tenantId, "message.sent", { conversationId: conversation.id, message: { id: sent.id, direction: sent.direction, status: sent.status, content: sent.content, occurredAt: sent.occurredAt.toISOString() } });
    return sent;
  }
}
