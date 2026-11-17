import {assignedConversationScope} from "./conversation-visibility";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { isUUID } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { PIPELINE_TEMPLATES } from "./departments.controller";
import { mutateTenantSetting } from "../prisma/tenant-settings";
export async function accessiblePipeline(
  prisma: PrismaService,
  req: AuthenticatedRequest,
  id: string,
) {
  if (!isUUID(id)) throw new BadRequestException("Selecione um pipeline.");
  const pipeline = await prisma.crmPipeline.findFirst({
    where: {
      id,
      tenantId: req.user.tenantId,
      ...(!administrative(req.user.role)
        ? {
            enabled: true,
            department: {
              isActive: true,
              modules: { has: "CRM" },
              members: {
                some: { tenantId: req.user.tenantId, userId: req.user.sub },
              },
            },
          }
        : {}),
    },
  });
  if (!pipeline)
    throw new BadRequestException("Pipeline não encontrado ou sem acesso.");
  return pipeline;
}
export async function contactPipelineAccess(
  prisma: PrismaService,
  req: AuthenticatedRequest,
  id: string,
) {
  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: req.user.tenantId },
    select: { pipelineId: true },
  });
  if (!contact) throw new BadRequestException("Contato não encontrado.");
  if (!administrative(req.user.role)) {
    if(!contact.pipelineId){const permitted=req.user.allowedModules?.includes('INBOX')&&await prisma.conversation.findFirst({where:{tenantId:req.user.tenantId,contactId:id,deletedAt:null,...assignedConversationScope(req.user.tenantId,req.user.sub,req.user.departmentIds||[])},select:{id:true}});if(!permitted)throw new BadRequestException('Este contato não pertence a um CRM permitido.');return contact;}
    await accessiblePipeline(prisma, req, contact.pipelineId);
  }
  return contact;
}
@Controller("crm")
@UseGuards(AuthGuard)
export class CrmPipelinesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("custom-fields")
  async customFields(@Req() req: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { integrations: true } });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown>
      : {};
    const raw = integrations.customFields;
    return Array.isArray(raw) ? raw : [];
  }

  @Post("custom-fields")
  async saveCustomFields(@Req() req: AuthenticatedRequest, @Body("fields") fields: unknown) {
    if (!administrative(req.user.role)) throw new ForbiddenException("Somente administradores podem configurar campos.");
    if (!Array.isArray(fields) || fields.length > 100) throw new BadRequestException("Envie até 100 campos personalizados.");
    const allowedTypes = ["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"] as const;
    const normalized = fields.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Campo personalizado inválido.");
      const value = raw as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 80) : "";
      const label = typeof value.label === "string" ? value.label.trim().slice(0, 120) : "";
      const type = typeof value.type === "string" ? value.type.trim().toUpperCase() : "TEXT";
      const pipelineIds = Array.isArray(value.pipelineIds) ? value.pipelineIds.filter((id): id is string => typeof id === "string" && isUUID(id)).slice(0, 50) : [];
      const options = Array.isArray(value.options) ? value.options.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 120)).slice(0, 50) : [];
      if (!id || !label || !allowedTypes.includes(type as typeof allowedTypes[number])) throw new BadRequestException("Cada campo precisa de id, nome e tipo válido.");
      if (type === "SELECT" && !options.length) throw new BadRequestException("Campos de seleção precisam de opções.");
      return { id, label, type, pipelineIds, options, enabled: value.enabled !== false };
    });
    const ids = new Set<string>();
    for (const field of normalized) {
      if (ids.has(field.id)) throw new BadRequestException("Não pode haver dois campos com o mesmo identificador.");
      ids.add(field.id);
    }
    await mutateTenantSetting(this.prisma, req.user.tenantId, "customFields", () => normalized);
    return normalized;
  }

  @Get("pipelines") async list(@Req() req: AuthenticatedRequest) {
    const pipelines = await this.prisma.crmPipeline.findMany({
      where: {
        tenantId: req.user.tenantId,
        enabled: true,
        ...(!administrative(req.user.role)
          ? {
              department: {
                isActive: true,
                modules: { has: "CRM" },
                members: {
                  some: { tenantId: req.user.tenantId, userId: req.user.sub },
                },
              },
            }
          : {}),
      },
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    const enriched = [] as any[];
    for (const pipeline of pipelines) {
      let stageCounts: Array<{ stage: string | null; count: bigint }> = [];
      let finalizationCounts: Array<{ outcome: string | null; count: bigint }> = [];
      try {
        stageCounts = await this.prisma.$queryRaw<Array<{ stage: string | null; count: bigint }>>`
          SELECT metadata->>'crmStage' AS stage, COUNT(*)::bigint AS count
          FROM contacts
          WHERE tenant_id = ${req.user.tenantId}::uuid AND pipeline_id = ${pipeline.id}::uuid AND metadata->>'crmStage' IS NOT NULL
          GROUP BY metadata->>'crmStage'`;
        finalizationCounts = await this.prisma.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
          SELECT metadata->'crmFinalization'->>'outcome' AS outcome, COUNT(*)::bigint AS count
          FROM contacts
          WHERE tenant_id = ${req.user.tenantId}::uuid AND pipeline_id = ${pipeline.id}::uuid AND metadata->'crmFinalization'->>'outcome' IS NOT NULL
          GROUP BY metadata->'crmFinalization'->>'outcome'`;
      } catch {
        stageCounts = [];
        finalizationCounts = [];
      }
      const stages = Array.isArray(pipeline.stages) ? (pipeline.stages as Array<Record<string, unknown>>) : [];
      const countOf = (id: unknown) => Number(stageCounts.find((row) => row.stage === id)?.count ?? 0n);
      const outcomeOf = (value: string) => Number(finalizationCounts.find((row) => row.outcome === value)?.count ?? 0n);
      enriched.push({
        ...pipeline,
        stages: stages.map((stage) => ({ ...stage, count: countOf(stage.id) })),
        won: outcomeOf("WON"),
        lost: outcomeOf("LOSS"),
      });
    }
    return {
      templates: PIPELINE_TEMPLATES,
      pipelines: enriched,
    };
  }
}
