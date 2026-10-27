import { whatsappPhone } from './whatsapp-bridge';
import { mutateTenantSetting } from "../prisma/tenant-settings";
import { BadGatewayException, BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { isUUID } from "class-validator";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { SendMessageDto } from "./dto/send-message.dto";
import { WahaService } from "./waha.service";
import { ZernioService } from "./zernio.service";


function isFinalizedConversation(metadata: unknown, conversationId: string): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const finalization = (metadata as Record<string, unknown>).crmFinalization;
  if (!finalization || typeof finalization !== "object" || Array.isArray(finalization)) return false;
  const ids = (finalization as Record<string, unknown>).finalizedConversationIds;
  return Array.isArray(ids) && ids.includes(conversationId);
}

@Controller("conversations")
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService, private readonly waha: WahaService, private readonly zernio: ZernioService) {}

  // Quick replies are stored per tenant so all agents in the same company share
  // the same catalog without browser-local storage or cross-tenant leakage.
  @Get("quick-replies")
  async listQuickReplies(@Req() request: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { integrations: true },
    });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown>
      : {};
    const raw = integrations.quickReplies;
    return Array.isArray(raw) ? raw.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
  }

  @Post("quick-replies")
  async saveQuickReplies(@Req() request: AuthenticatedRequest, @Body() input: { items?: unknown }) {
    if (!Array.isArray(input.items) || input.items.length > 200) {
      throw new BadRequestException("Envie uma lista válida de até 200 respostas rápidas.");
    }
    const items = input.items.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new BadRequestException("Cada resposta rápida deve ser um objeto válido.");
      }
      const item = raw as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id.trim().slice(0, 80) : "";
      const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
      const content = typeof item.content === "string" ? item.content.trim().slice(0, 4000) : "";
      const category = typeof item.category === "string" ? item.category.trim().slice(0, 80) : "";
      const shortcut = typeof item.shortcut === "string" ? item.shortcut.trim().replace(/^\/+/, "").slice(0, 40) : "";
      if (!id || !title || !content) throw new BadRequestException("Título e conteúdo são obrigatórios em cada resposta rápida.");
      return { id, title, content, category, shortcut };
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { integrations: true },
    });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");
    const integrations = tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown>
      : {};
    await mutateTenantSetting(this.prisma, request.user.tenantId, "quickReplies", () => items);
    return items;
  }

  // Greeting and sign-off templates are tenant-scoped and shared by that company's agents.
  @Get("quick-reply-settings")
  async getQuickReplySettings(@Req() request: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { integrations: true },
    });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown>
      : {};
    const settings = integrations.quickReplySettings;
    return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  }

  @Post("quick-reply-settings")
  async saveQuickReplySettings(@Req() request: AuthenticatedRequest, @Body() input: { settings?: unknown }) {
    if (!input.settings || typeof input.settings !== "object" || Array.isArray(input.settings)) {
      throw new BadRequestException("Envie configurações válidas para as respostas rápidas.");
    }
    const raw = input.settings as Record<string, unknown>;
    const cleanText = (value: unknown, fallback: string) => typeof value === "string" ? value.trim().slice(0, 240) : fallback;
    const defaults = {
      companyName: "",
      greetings: { dawn: "Olá, boa madrugada!", morning: "Bom dia!", afternoon: "Boa tarde!", evening: "Boa noite!" },
      farewells: { dawn: "Tenha uma ótima madrugada!", morning: "Tenha um ótimo dia!", afternoon: "Tenha uma ótima tarde!", evening: "Tenha uma ótima noite!" },
    };
    const readPeriod = (key: "dawn" | "morning" | "afternoon" | "evening", group: "greetings" | "farewells") => {
      const source = raw[group];
      const values = source && typeof source === "object" && !Array.isArray(source) ? source as Record<string, unknown> : {};
      return cleanText(values[key], defaults[group][key]);
    };
    const settings = {
      companyName: cleanText(raw.companyName, ""),
      greetings: { dawn: readPeriod("dawn", "greetings"), morning: readPeriod("morning", "greetings"), afternoon: readPeriod("afternoon", "greetings"), evening: readPeriod("evening", "greetings") },
      farewells: { dawn: readPeriod("dawn", "farewells"), morning: readPeriod("morning", "farewells"), afternoon: readPeriod("afternoon", "farewells"), evening: readPeriod("evening", "farewells") },
    };
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { integrations: true },
    });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");
    const integrations = tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown>
      : {};
    await mutateTenantSetting(this.prisma, request.user.tenantId, "quickReplySettings", () => settings);
    return settings;
  }

  @Get("counts")
  async counts(@Req() request: AuthenticatedRequest) {
    const tenantId=request.user.tenantId;
    const teamIds=await this.memberDepartmentIds(tenantId,request.user.sub);
    const entries=await Promise.all(["new","mine","team"].map(async view=>{
      const access=await this.accessWhere(request,view);
      const where={tenantId,...access,status:{in:["OPEN","PENDING"]},archivedAt:null,deletedAt:null,...(view==="new"?{assigneeId:null,departmentId:null}:view==="mine"?{assigneeId:request.user.sub}:{departmentId:{in:teamIds}})};
      return [view,await this.prisma.conversation.count({where:where as any})] as const;
    }));
    return Object.fromEntries(entries);
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query("view") view = "new", @Query("status") status?: string, @Query("focus") focus?: string) {
    const tenantId = request.user.tenantId;
    const normalizedView = ["new", "mine", "team", "others", "all-open", "completed", "archived", "trash"].includes(view) ? view : "new";
    const accessWhere = await this.accessWhere(request, normalizedView);
    const where: Record<string, any> = { tenantId, ...accessWhere };
    if(focus){if(!isUUID(focus))throw new BadRequestException("Conversa inválida");where.id=focus;}
    if (normalizedView === "new") Object.assign(where, { status: { in: ["OPEN", "PENDING"] }, assigneeId: null, departmentId: null, archivedAt: null, deletedAt: null });
    else if (normalizedView === "mine") Object.assign(where, { assigneeId: request.user.sub, archivedAt: null, deletedAt: null, status: { in: ["OPEN", "PENDING"] } });
    else if (normalizedView === "team") Object.assign(where, { departmentId: { in: await this.memberDepartmentIds(tenantId, request.user.sub) }, archivedAt: null, deletedAt: null, status: { in: ["OPEN", "PENDING"] } });
    else if (normalizedView === "others") Object.assign(where, { participants: { some: { tenantId, userId: request.user.sub } }, archivedAt: null, deletedAt: null });
    else if (normalizedView === "all-open") Object.assign(where, { status: { in: ["OPEN", "PENDING"] }, archivedAt: null, deletedAt: null });
    else if (normalizedView === "completed") Object.assign(where, { status: { in: ["RESOLVED", "CLOSED"] }, archivedAt: null, deletedAt: null });
    else if (normalizedView === "archived") Object.assign(where, { archivedAt: { not: null }, deletedAt: null });
    else if (normalizedView === "trash") Object.assign(where, { deletedAt: { not: null } });
    if (status && ["OPEN", "PENDING", "RESOLVED", "CLOSED"].includes(status.toUpperCase()) && !["new", "mine", "team", "others", "all-open", "completed", "archived", "trash"].includes(view)) where.status = status.toUpperCase();
    const rows = await this.prisma.conversation.findMany({
      where: where as any,
      include: { contact: { select: { id: true, name: true, phone: true, email: true, externalId: true, metadata: true } }, assignee: { select: { id: true, name: true } }, department: { select: { id: true, key: true, name: true } }, messages: { orderBy: { occurredAt: "desc" }, take: 1 }, participants: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 100,
    });
    return rows.filter((conversation) => !isFinalizedConversation(conversation.contact.metadata, conversation.id));
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

  @Post(':id/whatsapp')
  async continueOnWhatsapp(@Req() request:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:{phone?:string;channelId?:string},@Query('view') view='new'){
    await this.assertCanAccess(request,id,view);
    const source=await this.prisma.conversation.findFirstOrThrow({where:{id,tenantId:request.user.tenantId},include:{contact:true}});
    const phone=whatsappPhone(input.phone);
    if(input.channelId&&!isUUID(input.channelId))throw new BadRequestException('Canal inválido.');
    const channel=await this.prisma.channelConnection.findFirst({where:{tenantId:request.user.tenantId,provider:'WAHA',status:'CONNECTED',isActive:true,...(input.channelId?{id:input.channelId}:{})},orderBy:{createdAt:'asc'}});
    if(!channel)throw new BadRequestException('Conecte um WhatsApp para continuar.');
    const conversation=await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${request.user.tenantId}::uuid FOR UPDATE`;
      // Social identities remain separate; linking never turns a typed phone into verified identity.
      const target=await tx.contact.upsert({where:{tenantId_externalId:{tenantId:request.user.tenantId,externalId:phone+'@c.us'}},create:{tenantId:request.user.tenantId,name:source.contact.name,phone,externalId:phone+'@c.us',source:'WHATSAPP'},update:{}});
      let next=await tx.conversation.findFirst({where:{tenantId:request.user.tenantId,contactId:target.id,channelConnectionId:channel.id,channel:'WHATSAPP',deletedAt:null,archivedAt:null,status:{in:['OPEN','PENDING']}},orderBy:{createdAt:'desc'}});
      if(!next)next=await tx.conversation.create({data:{tenantId:request.user.tenantId,contactId:target.id,channelConnectionId:channel.id,channel:'WHATSAPP',handlingMode:'HUMAN',assigneeId:request.user.sub}});
      if(source.id!==next.id){
        const previous=await tx.auditLog.findFirst({where:{tenantId:request.user.tenantId,entityId:source.id,action:'conversation.whatsapp.linked',details:{path:['conversationId'],equals:next.id}}});
        if(!previous){await tx.message.createMany({data:[{tenantId:request.user.tenantId,conversationId:source.id,direction:'INTERNAL',status:'SENT',content:'Atendimento continuado no WhatsApp.',metadata:{linkedConversationId:next.id}},{tenantId:request.user.tenantId,conversationId:next.id,direction:'INTERNAL',status:'SENT',content:'Atendimento iniciado em outro canal. O histórico de origem está preservado.',metadata:{linkedConversationId:source.id}}]});}
      }
      await tx.auditLog.create({data:{tenantId:request.user.tenantId,userId:request.user.sub,action:'conversation.whatsapp.linked',entityType:'conversation',entityId:source.id,details:{conversationId:next.id,contactId:target.id}}});
      return next;
    });
    this.events.publish(request.user.tenantId,'conversation.created',{id:conversation.id,contactId:conversation.contactId,status:conversation.status});
    return {conversationId:conversation.id,channel:'WHATSAPP',sent:false};
  }

  @Get("assignees")
  async assignees(@Req() request: AuthenticatedRequest) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId: request.user.tenantId, user: { isActive: true } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map(({ user }) => user).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  @Post(":id/assume")
  async assume(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Query("view") view = "new") {
    await this.assertCanAccess(request, id, view);
    const tenantId = request.user.tenantId;
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true, assigneeId: true, status: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (conversation.status === "CLOSED" || conversation.status === "RESOLVED") throw new BadRequestException("Reabra a conversa antes de assumi-la.");
    const membership = await this.prisma.membership.findFirst({ where: { tenantId, userId: request.user.sub }, select: { id: true } });
    if (!membership) throw new BadRequestException("Você não faz parte desta empresa.");
    // Conditional update prevents two agents from simultaneously taking the same unassigned conversation.
    const claimed = await this.prisma.conversation.updateMany({
      where: { id, tenantId, status: { in: ["OPEN", "PENDING"] }, OR: [{ assigneeId: null }, { assigneeId: request.user.sub }] },
      data: { assigneeId: request.user.sub },
    });
    if (!claimed.count) throw new BadRequestException("Esta conversa já foi atribuída a outro atendente ou não está mais disponível.");
    const updated = await this.prisma.conversation.findFirst({ where: { id, tenantId }, include: { assignee: { select: { id: true, name: true } } } });
    if (!updated) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    this.events.publish(tenantId, "conversation.updated", { id, status: updated.status, assigneeId: updated.assigneeId });
    return updated;
  }

  @Post(":id/assign")
  async assign(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body("userId") userId: string | null | undefined, @Query("view") view = "new") {
    await this.assertCanAccess(request, id, view);
    const tenantId = request.user.tenantId;
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (conversation.status === "CLOSED" || conversation.status === "RESOLVED") throw new BadRequestException("Reabra a conversa antes de alterar o responsável.");
    if (userId !== null && userId !== undefined) {
      if (!isUUID(userId)) throw new BadRequestException("Atendente inválido.");
      const membership = await this.prisma.membership.findFirst({ where: { tenantId, userId, user: { isActive: true } }, select: { id: true } });
      if (!membership) throw new BadRequestException("O atendente selecionado não pertence a esta empresa.");
    }
    const updated = await this.prisma.conversation.update({ where: { id }, data: { assigneeId: userId ?? null }, include: { assignee: { select: { id: true, name: true } } } });
    this.events.publish(tenantId, "conversation.updated", { id, status: updated.status, assigneeId: updated.assigneeId });
    return updated;
  }

  @Post(":id/status")
  async updateStatus(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body("status") status: string, @Query("view") view = "new") {
    await this.assertCanAccess(request, id, view);
    const allowed = ["OPEN", "PENDING", "RESOLVED"] as const;
    if (!allowed.includes(status as typeof allowed[number])) throw new BadRequestException("Status de conversa inválido.");
    const tenantId = request.user.tenantId;
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true, status: true, contactId: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (conversation.status === "CLOSED") throw new BadRequestException("Esta conversa está encerrada permanentemente.");
    if (status !== "RESOLVED") {
      const contact = await this.prisma.contact.findFirst({ where: { id: conversation.contactId, tenantId }, select: { metadata: true } });
      if (contact && isFinalizedConversation(contact.metadata, conversation.id)) throw new BadRequestException("Este atendimento foi finalizado comercialmente e permanece fora da fila. Consulte Contatos.");
    }
    const updated = await this.prisma.conversation.update({ where: { id }, data: { status: status as typeof allowed[number] } });
    this.events.publish(tenantId, "conversation.updated", { id, status: updated.status });
    return updated;
  }

  @Post(":id/handoff")
  async handoff(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: { departmentId?: unknown; assigneeId?: unknown },
    @Query("view") view = "new",
  ) {
    await this.assertCanAccess(request, id, view);
    const tenantId = request.user.tenantId;
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (conversation.status === "CLOSED" || conversation.status === "RESOLVED") {
      throw new BadRequestException("Reabra a conversa antes de transferi-la para um atendente.");
    }
    const departmentId = typeof input.departmentId === "string" && input.departmentId ? input.departmentId : null;
    const assigneeId = typeof input.assigneeId === "string" && input.assigneeId ? input.assigneeId : null;
    if (departmentId) {
      if (!isUUID(departmentId) || !await this.prisma.department.findFirst({ where: { id: departmentId, tenantId, isActive: true }, select: { id: true } })) {
        throw new BadRequestException("Departamento inválido para esta empresa.");
      }
    }
    if (assigneeId) {
      if (!isUUID(assigneeId) || !await this.prisma.membership.findFirst({ where: { tenantId, userId: assigneeId, user: { isActive: true } }, select: { id: true } })) {
        throw new BadRequestException("Atendente inválido para esta empresa.");
      }
    }
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { handlingMode: "HUMAN", departmentId, assigneeId, status: "OPEN" },
      include: { assignee: { select: { id: true, name: true } }, department: { select: { id: true, key: true, name: true } } },
    });
    this.events.publish(tenantId, "conversation.updated", { id, handlingMode: "HUMAN", departmentId, assigneeId, status: updated.status });
    return updated;
  }

  @Post(":id/return-to-bot")
  async returnToBot(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Query("view") view = "new") {
    await this.assertCanAccess(request, id, view);
    const tenantId = request.user.tenantId;
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (conversation.status === "CLOSED" || conversation.status === "RESOLVED") {
      throw new BadRequestException("Reabra a conversa antes de devolvê-la ao bot.");
    }
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { handlingMode: "BOT", departmentId: null, assigneeId: null },
      select: { id: true, handlingMode: true, departmentId: true, assigneeId: true, status: true },
    });
    this.events.publish(tenantId, "conversation.updated", { id, handlingMode: "BOT", departmentId: null, assigneeId: null, status: updated.status });
    return updated;
  }

  @Get(":id/messages")
  async messages(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Query("view") view = "new") {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId: request.user.tenantId, ...(await this.accessWhere(request, view)) } as any, select: { id: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    return this.prisma.message.findMany({ where: { conversationId: conversation.id, tenantId: request.user.tenantId }, orderBy: { occurredAt: "asc" }, take: 500 });
  }

  @Post(":id/messages")
  async sendMessage(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: SendMessageDto, @Query("view") view = "new") {
    const tenantId = request.user.tenantId;
    const conversation = await this.prisma.conversation.findFirst({ where: { id, tenantId, ...(await this.accessWhere(request, view)) } as any, include: { contact: true, channelConnection: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (isFinalizedConversation(conversation.contact.metadata, conversation.id)) throw new BadRequestException("Este atendimento foi finalizado. Consulte o histórico em Contatos.");
    if (conversation.deletedAt || conversation.archivedAt) throw new BadRequestException("Restaure a conversa antes de enviar novas mensagens.");
    if (conversation.status === "CLOSED") throw new BadRequestException("Esta conversa já foi encerrada.");
    if (!conversation.channelConnection || !["WAHA", "ZERNIO"].includes(conversation.channelConnection.provider) || !conversation.channelConnection.isActive) {
      throw new BadRequestException("Esta conversa não possui um canal de mensagens conectado.");
    }
    const isZernio = conversation.channelConnection.provider === "ZERNIO";
    const contactMetadata = conversation.contact.metadata && typeof conversation.contact.metadata === "object" && !Array.isArray(conversation.contact.metadata)
      ? conversation.contact.metadata as Record<string, unknown> : {};
    const externalConversationId = typeof contactMetadata.externalConversationId === "string" ? contactMetadata.externalConversationId : "";
    const linkedAccountId = isZernio ? String((conversation.channelConnection.settings as Record<string, unknown> | null)?.accountId || "") : "";
    if (isZernio && (!linkedAccountId || contactMetadata.accountId !== linkedAccountId || contactMetadata.provider !== "ZERNIO")) {
      throw new BadRequestException("A conversa não corresponde à conta Zernio vinculada a este canal.");
    }
    const chatId = isZernio ? externalConversationId : (conversation.contact.externalId?.includes("@") ? conversation.contact.externalId
      : conversation.contact.phone ? `${conversation.contact.phone.replace(/\D/g, "")}@c.us` : conversation.contact.externalId);
    if (!chatId) throw new BadRequestException(isZernio ? "A conversa não possui um identificador externo para resposta." : "O contato não possui um identificador WhatsApp válido.");
    const user = await this.prisma.user.findUnique({ where: { id: request.user.sub }, select: { name: true } });
    const content = input.content.trim();
    if (!content) throw new BadRequestException("Digite uma mensagem antes de enviar.");

    const queued = await this.prisma.message.create({ data: { tenantId, conversationId: conversation.id, direction: "OUTBOUND", status: "QUEUED", content, contentType: "text", senderName: user?.name || null, metadata: { provider: isZernio ? "ZERNIO" : "WAHA" } } });
    this.events.publish(tenantId, "message.queued", { conversationId: conversation.id, message: { id: queued.id, direction: queued.direction, status: queued.status, content: queued.content } });
    let providerMessageId: string | null;
    try {
      if (isZernio) {
        const result = await this.zernio.request<any>("/inbox/conversations/" + encodeURIComponent(chatId) + "/messages", { method: "POST", body: { accountId: linkedAccountId, message: content }, idempotencyKey: randomUUID() });
        providerMessageId = result?.data?.messageId || result?.id || null;
      } else {
        providerMessageId = await this.waha.sendText(conversation.channelConnection, chatId, content);
      }
    }
    catch {
      const failed = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "FAILED", metadata: { provider: isZernio ? "ZERNIO" : "WAHA", errorCode: "SEND_FAILED" } } });
      this.events.publish(tenantId, "message.failed", { conversationId: conversation.id, message: { id: failed.id, status: failed.status, content: failed.content } });
      throw new BadGatewayException("A mensagem não foi enviada. A falha ficou registrada no histórico.");
    }
    const sent = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "SENT", providerMessageId } });
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: sent.occurredAt, ...(conversation.status === "RESOLVED" ? { status: "OPEN" } : {}) } });
    this.events.publish(tenantId, "message.sent", { conversationId: conversation.id, message: { id: sent.id, direction: sent.direction, status: sent.status, content: sent.content, occurredAt: sent.occurredAt.toISOString() } });
    return sent;
  }
  private async memberDepartmentIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.prisma.departmentMember.findMany({ where: { tenantId, userId }, select: { departmentId: true } });
    return rows.map((row) => row.departmentId);
  }

  private async accessWhere(request: AuthenticatedRequest, view = "new"): Promise<Record<string, any>> {
    if (["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) return {};
    if (view === "new") return { assigneeId: null, departmentId: null, status: { in: ["OPEN", "PENDING"] }, archivedAt: null, deletedAt: null };
    if (view === "all-open") return { status: { in: ["OPEN", "PENDING"] }, archivedAt: null, deletedAt: null };
    const departmentIds = await this.memberDepartmentIds(request.user.tenantId, request.user.sub);
    return { OR: [
      { assigneeId: request.user.sub },
      { departmentId: { in: departmentIds } },
      { participants: { some: { tenantId: request.user.tenantId, userId: request.user.sub } } },
    ] };
  }

  private async assertCanAccess(request: AuthenticatedRequest, conversationId: string, view = "new"): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId: request.user.tenantId, ...(await this.accessWhere(request, view)) } as any, select: { id: true } });
    if (!conversation) throw new NotFoundException("Conversa não encontrada ou você não tem acesso a ela.");
  }

  @Post(":id/invite")
  async invite(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body("userId") userId: string, @Query("view") view = "new") {
    await this.assertCanAccess(request, id, view);
    if (!isUUID(userId)) throw new BadRequestException("Atendente inválido.");
    const member = await this.prisma.membership.findFirst({ where: { tenantId: request.user.tenantId, userId, user: { isActive: true } }, select: { id: true } });
    if (!member) throw new BadRequestException("O atendente selecionado não pertence a esta empresa.");
    const participant = await this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: id, userId } },
      create: { tenantId: request.user.tenantId, conversationId: id, userId, kind: "INVITED" },
      update: { kind: "INVITED" },
      include: { user: { select: { id: true, name: true } } },
    });
    this.events.publish(request.user.tenantId, "conversation.updated", { id, invitedUserId: userId });
    return participant;
  }

  @Post(":id/archive")
  async archive(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Query("view") view = "new") {
    await this.assertCanAccess(request, id, view);
    const updated = await this.prisma.conversation.update({ where: { id }, data: { archivedAt: new Date() } });
    this.events.publish(request.user.tenantId, "conversation.updated", { id, archivedAt: updated.archivedAt });
    return updated;
  }

  @Post(":id/restore")
  async restore(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Query("view") view = "new") {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) await this.assertCanAccess(request, id, view);
    const existing = await this.prisma.conversation.findFirst({ where: { id, tenantId: request.user.tenantId }, include: { contact: { select: { metadata: true } } } });
    if (!existing) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    if (isFinalizedConversation(existing.contact.metadata, existing.id)) throw new BadRequestException("Este atendimento foi finalizado comercialmente e não pode voltar à fila.");
    const updated = await this.prisma.conversation.update({ where: { id, tenantId: request.user.tenantId }, data: { archivedAt: null, deletedAt: null, status: "OPEN" } });
    this.events.publish(request.user.tenantId, "conversation.updated", { id, archivedAt: null, deletedAt: null, status: updated.status });
    return updated;
  }

  @Post(":id/trash")
  async trash(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Query("view") view = "new") {
    await this.assertCanAccess(request, id, view);
    const updated = await this.prisma.conversation.update({ where: { id, tenantId: request.user.tenantId }, data: { deletedAt: new Date() } });
    this.events.publish(request.user.tenantId, "conversation.updated", { id, deletedAt: updated.deletedAt });
    return updated;
  }

}

