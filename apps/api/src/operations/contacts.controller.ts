import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateContactDto } from "./dto/create-contact.dto";

@Controller("contacts")
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("q") query?: string) {
    const q = query?.trim();
    return this.prisma.contact.findMany({
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
  }

  @Patch(":id/pipeline-stage")
  async updatePipelineStage(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() input: { stage?: string },
  ) {
    const allowedStages = new Set(["lead", "contacted", "qualified", "proposal", "won", "lost"]);
    if (!input.stage || !allowedStages.has(input.stage)) {
      throw new BadRequestException("Etapa do pipeline inválida.");
    }
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId: request.user.tenantId },
    });
    if (!contact) {
      throw new BadRequestException("Contato não encontrado nesta empresa.");
    }
    const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
      ? contact.metadata as Prisma.InputJsonObject
      : {};
    const updated = await this.prisma.contact.update({
      where: { id: contact.id },
      data: { metadata: { ...metadata, pipelineStage: input.stage } as Prisma.InputJsonObject },
    });
    this.events.publish(request.user.tenantId, "contact.updated", {
      id: updated.id,
      name: updated.name,
      pipelineStage: input.stage,
    });
    return updated;
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
