import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateContactDto } from "./dto/create-contact.dto";

const CRM_STAGES = ["new", "qualification", "proposal", "won", "lost"] as const;
type CrmStage = (typeof CRM_STAGES)[number];
function readCrmStage(metadata: Prisma.JsonValue): CrmStage {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata) && "crmStage" in metadata) {
    const stage = metadata.crmStage;
    if (typeof stage === "string" && CRM_STAGES.includes(stage as CrmStage)) return stage as CrmStage;
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
    return contacts.map((contact) => ({ ...contact, crmStage: readCrmStage(contact.metadata) }));
  }

  @Get(":id/history")
  async history(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId: request.user.tenantId }, select: { id: true } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    return this.prisma.conversation.findMany({ where: { contactId: contact.id, tenantId: request.user.tenantId }, select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  @Patch(":id/profile")
  async updateProfile(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() input: { tags?: unknown; notes?: unknown; customFields?: unknown }) {
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId: request.user.tenantId } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.some((tag) => typeof tag !== "string" || tag.length > 40))) throw new BadRequestException("Etiquetas inválidas.");
    if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > 10000)) throw new BadRequestException("Anotações inválidas.");
    if (input.customFields !== undefined && (!input.customFields || typeof input.customFields !== "object" || Array.isArray(input.customFields))) throw new BadRequestException("Campos personalizados inválidos.");
    const existing = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Prisma.JsonObject : {};
    const metadata: Prisma.InputJsonObject = { ...existing, ...(input.tags !== undefined ? { tags: input.tags as Prisma.InputJsonValue } : {}), ...(input.notes !== undefined ? { notes: input.notes } : {}), ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}) };
    const updated = await this.prisma.contact.update({ where: { id: contact.id }, data: { metadata } });
    this.events.publish(request.user.tenantId, "contact.updated", { id: updated.id });
    return { id: updated.id, metadata: updated.metadata };
  }

  @Patch(":id/stage")
  async updateStage(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() input: { stage?: string }) {
    if (!input.stage || !CRM_STAGES.includes(input.stage as CrmStage)) throw new BadRequestException("Etapa de CRM inválida.");
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId: request.user.tenantId } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Prisma.JsonObject : {};
    const updated = await this.prisma.contact.update({ where: { id: contact.id }, data: { metadata: { ...metadata, crmStage: input.stage } } });
    this.events.publish(request.user.tenantId, "contact.stage_changed", { id: updated.id, stage: input.stage });
    return { ...updated, crmStage: input.stage };
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
