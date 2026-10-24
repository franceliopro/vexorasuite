import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateContactDto } from "./dto/create-contact.dto";

const CRM_STAGES = ["new", "qualification", "proposal"] as const;
type CrmStage = (typeof CRM_STAGES)[number];
function readCrmStage(metadata: Prisma.JsonValue): CrmStage | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    if ("crmFinalization" in metadata && metadata.crmFinalization) return null;
    if (metadata.contactType === "CUSTOMER") return null;
    if ("asaas" in metadata && metadata.asaas && typeof metadata.asaas === "object" && !Array.isArray(metadata.asaas) && "customerId" in metadata.asaas) return null;
    if ("crmStage" in metadata) { const stage = metadata.crmStage; if (typeof stage === "string" && CRM_STAGES.includes(stage as CrmStage)) return stage as CrmStage; }
  }
  return "new";
}

@Controller("contacts")
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query("q") query?: string) {
    const q = query?.trim();
    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId: request.user.tenantId,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return contacts.map((contact) => { const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Prisma.JsonObject : {}; return { ...contact, crmStage: readCrmStage(contact.metadata), crmFinalization: metadata.crmFinalization ?? null }; });
  }

  @Get(":id/history")
  async history(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId: request.user.tenantId }, select: { id: true } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    return this.prisma.conversation.findMany({ where: { contactId: contact.id, tenantId: request.user.tenantId }, select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  @Patch(":id/profile")
  async updateProfile(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() input: { tags?: unknown; notes?: unknown; customFields?: unknown; leadOrigin?: unknown }) {
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId: request.user.tenantId } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 50 || input.tags.some((tag) => typeof tag === "string" ? tag.length > 40 : !tag || typeof tag !== "object" || Array.isArray(tag) || typeof (tag as Record<string, unknown>).name !== "string" || ((tag as Record<string, unknown>).name as string).trim().length < 1 || ((tag as Record<string, unknown>).name as string).length > 40 || typeof (tag as Record<string, unknown>).color !== "string" || !/^#[0-9a-fA-F]{6}$/.test((tag as Record<string, unknown>).color as string)))) throw new BadRequestException("Etiquetas inválidas.");
    if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > 10000)) throw new BadRequestException("Anotações inválidas.");
    if (input.customFields !== undefined && (!input.customFields || typeof input.customFields !== "object" || Array.isArray(input.customFields))) throw new BadRequestException("Campos personalizados inválidos.");
    if (input.leadOrigin !== undefined && (typeof input.leadOrigin !== "string" || input.leadOrigin.length > 120)) throw new BadRequestException("Origem do lead inválida.");
    const existing = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Prisma.JsonObject : {};
    const metadata: Prisma.InputJsonObject = { ...existing, ...(input.tags !== undefined ? { tags: input.tags as Prisma.InputJsonValue } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}), ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}), ...(input.leadOrigin !== undefined ? { leadOrigin: { source: input.leadOrigin.trim() } } : {}) };
    const updated = await this.prisma.contact.update({ where: { id: contact.id }, data: { metadata } });
    this.events.publish(request.user.tenantId, "contact.updated", { id: updated.id });
    return { id: updated.id, metadata: updated.metadata };
  }

  @Patch(":id/stage")
  async updateStage(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() input: { stage?: string }) {
    if (!input.stage || !CRM_STAGES.includes(input.stage as CrmStage)) throw new BadRequestException("Etapa de CRM inválida. Para finalizar, registre o resultado comercial.");
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId: request.user.tenantId } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Prisma.JsonObject : {};
    if (metadata.crmFinalization) throw new BadRequestException("Este contato já foi finalizado. Consulte-o em Contatos.");
    const updated = await this.prisma.contact.update({ where: { id: contact.id }, data: { metadata: { ...metadata, crmStage: input.stage } } });
    this.events.publish(request.user.tenantId, "contact.stage_changed", { id: updated.id, stage: input.stage });
    return { ...updated, crmStage: input.stage };
  }


  @Post(":id/finalize")
  async finalize(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() input: { outcome?: string; reason?: string }) {
    const tenantId = request.user.tenantId;
    const outcome = input.outcome?.toUpperCase();
    if (outcome !== "WON" && outcome !== "LOST") throw new BadRequestException("Escolha se o resultado foi ganho ou perda.");
    const allowedReasons = ["Preço/Condição", "Sem interesse", "Sem retorno", "Concorrência", "Inatividade"];
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (outcome === "LOST" && !allowedReasons.includes(reason)) throw new BadRequestException("Selecione um motivo válido para a perda.");
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    const existing = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Prisma.JsonObject : {};
    const previousFinalization = existing.crmFinalization && typeof existing.crmFinalization === "object" && !Array.isArray(existing.crmFinalization) ? existing.crmFinalization as Prisma.JsonObject : {};
    const priorFinalizedIds = Array.isArray(previousFinalization.finalizedConversationIds) ? previousFinalization.finalizedConversationIds.filter((value): value is string => typeof value === "string") : [];
    const priorTags = Array.isArray(existing.tags) ? existing.tags.filter((tag) => typeof tag === "string" || (tag && typeof tag === "object" && !Array.isArray(tag) && typeof (tag as Record<string, unknown>).name === "string")) as Prisma.InputJsonValue[] : [];
    const tags = outcome === "WON" ? priorTags.filter((tag) => (typeof tag === "string" ? tag : String((tag as Record<string, unknown>).name || "")).trim().toLocaleLowerCase("pt-BR") !== "novo lead") : priorTags;
    const rest = Object.fromEntries(Object.entries(existing).filter(([key]) => key !== "crmStage" && key !== "crmFinalization")) as Prisma.JsonObject;
    const finalizedAt = new Date().toISOString();
    const result = await this.prisma.$transaction(async (tx) => {
      const existingConversations = await tx.conversation.findMany({ where: { tenantId, contactId: contact.id }, select: { id: true } });
      const active = await tx.conversation.findMany({ where: { tenantId, contactId: contact.id, status: { in: ["OPEN", "PENDING"] }, archivedAt: null, deletedAt: null }, select: { id: true } });
      const finalizedConversationIds = [...new Set([...priorFinalizedIds, ...existingConversations.map((item) => item.id)])];
      const metadata: Prisma.InputJsonObject = {
        ...rest,
        tags,
        contactType: outcome === "WON" ? "CUSTOMER" : (typeof existing.contactType === "string" ? existing.contactType : "LEAD"),
        crmFinalization: {
          outcome,
          ...(outcome === "LOST" ? { reason } : {}),
          finalizedAt,
          finalizedBy: request.user.sub,
          finalizedConversationIds,
        },
      };
      const updatedContact = await tx.contact.update({ where: { id: contact.id }, data: { metadata } });
      if (active.length) await tx.conversation.updateMany({ where: { tenantId, contactId: contact.id, id: { in: finalizedConversationIds }, status: { in: ["OPEN", "PENDING"] } }, data: { status: "RESOLVED" } });
      return { contact: updatedContact, conversations: active.map((item) => item.id) };
    });
    this.events.publish(tenantId, "contact.finalized", { id: result.contact.id, outcome, ...(outcome === "LOST" ? { reason } : {}) });
    for (const conversationId of result.conversations) this.events.publish(tenantId, "conversation.updated", { id: conversationId, status: "RESOLVED", finalizationOutcome: outcome });
    return { contact: { ...result.contact, crmStage: null, crmFinalization: (result.contact.metadata as Prisma.JsonObject).crmFinalization }, finalizedConversations: result.conversations.length };
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() input: CreateContactDto) {
    const contact = await this.prisma.contact.create({
      data: {
        tenantId: request.user.tenantId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        source: input.source?.trim() || null,
        externalId: input.externalId?.trim() || null,
      },
    });
    this.events.publish(request.user.tenantId, "contact.created", {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
    });
    return contact;
  }
}
