import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";

@Controller("conversations")
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("status") status?: string) {
    const allowed = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];
    const normalizedStatus = status?.toUpperCase();
    return this.prisma.conversation.findMany({
      where: {
        tenantId: request.user.tenantId,
        ...(normalizedStatus && allowed.includes(normalizedStatus)
          ? { status: normalizedStatus as "OPEN" | "PENDING" | "RESOLVED" | "CLOSED" }
          : {}),
      },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        messages: { orderBy: { occurredAt: "desc" }, take: 1 },
      },
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 100,
    });
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() input: CreateConversationDto) {
    const tenantId = request.user.tenantId;
    const contact = await this.prisma.contact.findFirst({
      where: { id: input.contactId, tenantId },
      select: { id: true },
    });
    if (!contact) throw new NotFoundException("Contato não encontrado nesta empresa.");

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel: input.channel?.trim().toUpperCase() || "WHATSAPP",
      },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });
    this.events.publish(tenantId, "conversation.created", {
      id: conversation.id,
      contactId: conversation.contactId,
      status: conversation.status,
    });
    return conversation;
  }

  @Get(":id/messages")
  async messages(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId: request.user.tenantId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");

    return this.prisma.message.findMany({
      where: { conversationId: conversation.id, tenantId: request.user.tenantId },
      orderBy: { occurredAt: "asc" },
      take: 500,
    });
  }
}
