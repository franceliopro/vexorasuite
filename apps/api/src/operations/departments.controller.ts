import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { administrative, moduleSelection } from "../auth/module-policy";
import { EventsService } from "./events.service";
export const PIPELINE_TEMPLATES = {
  GENERAL: ["Novos", "Em andamento", "Aguardando retorno", "Finalização"],
  FINANCE: ["Solicitações", "Em análise", "Em negociação", "Finalização"],
  SUPPORT: ["Novos chamados", "Diagnóstico", "Em solução", "Finalização"],
  SALES: ["Novos", "Qualificação", "Proposta", "Finalização"],
};
export function pipelineStages(template: keyof typeof PIPELINE_TEMPLATES) {
  return ["new", "qualification", "proposal", "finalization"].map((id, i) => ({
    id,
    label: PIPELINE_TEMPLATES[template][i],
    tone: ["violet", "blue", "amber", "green"][i],
  }));
}
@Controller("departments")
@UseGuards(AuthGuard)
export class DepartmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}
  private admin(req: AuthenticatedRequest) {
    if (!administrative(req.user.role))
      throw new ForbiddenException(
        "Somente administradores configuram setores e permissões.",
      );
  }
  @Get() async list(@Req() req: AuthenticatedRequest) {
    return this.prisma.department.findMany({
      where: {
        tenantId: req.user.tenantId,
        ...(!administrative(req.user.role)
          ? { id: { in: req.user.departmentIds || [] }, isActive: true }
          : {}),
      },
      select: {
        id: true,
        key: true,
        name: true,
        keywords: true,
        isActive: true,
        modules: true,
        routingCategory: true,
        routingPlatform: true,
        routingStrategy: true,
        maxOpenConversations: true,
        pipeline: {
          select: { id: true, name: true, template: true, enabled: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }
  private fields(input: any, creating = false) {
    const data: any = {};
    for (const [k, max] of [
      ["name", 80],
      ["key", 40],
      ["routingPlatform", 80],
    ] as const)
      if (input[k] !== undefined) {
        if (typeof input[k] !== "string" || input[k].length > max)
          throw new BadRequestException("Campo de setor inválido.");
        data[k] = input[k].trim() || null;
      }
    if (creating && (!data.name || !data.key))
      throw new BadRequestException("Informe nome e chave do setor.");
    if (data.key && !/^[A-Z0-9_-]+$/.test(data.key))
      throw new BadRequestException(
        "Use uma chave com letras maiúsculas, números e sublinhado.",
      );
    if (input.modules !== undefined) {
      try {
        data.modules = moduleSelection(input.modules);
      } catch {
        throw new BadRequestException("Seleção de módulos inválida.");
      }
    }
    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean")
        throw new BadRequestException("Estado inválido.");
      data.isActive = input.isActive;
    }
    if (input.routingCategory !== undefined) {
      if (
        !["FINANCE", "SUPPORT", "SALES", "ADMIN", "OTHER"].includes(
          input.routingCategory,
        )
      )
        throw new BadRequestException("Finalidade inválida.");
      data.routingCategory = input.routingCategory;
    }
    if (input.routingStrategy !== undefined) {
      if (!["ROUND_ROBIN", "LOAD_BALANCED"].includes(input.routingStrategy))
        throw new BadRequestException("Estratégia de distribuição inválida.");
      data.routingStrategy = input.routingStrategy;
    }
    if (input.maxOpenConversations !== undefined) {
      const limit = Number(input.maxOpenConversations);
      if (!Number.isInteger(limit) || limit < 0 || limit > 1000)
        throw new BadRequestException("O limite de atendimentos deve estar entre 0 e 1.000.");
      data.maxOpenConversations = limit;
    }
    if (input.keywords !== undefined) {
      if (
        !Array.isArray(input.keywords) ||
        input.keywords.length > 50 ||
        input.keywords.some((s: any) => typeof s !== "string" || s.length > 60)
      )
        throw new BadRequestException("Palavras-chave inválidas.");
      data.keywords = input.keywords
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return data;
  }
  private async save(req: AuthenticatedRequest, input: any, id?: string) {
    this.admin(req);
    const data = this.fields(input, !id);
    if (
      input.crmTemplate &&
      !Object.hasOwn(PIPELINE_TEMPLATES, input.crmTemplate)
    )
      throw new BadRequestException("Modelo de CRM inválido.");
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
      const old = id
        ? await tx.department.findFirst({
            where: { id, tenantId: req.user.tenantId },
          })
        : null;
      if (id && !old)
        throw new BadRequestException("Setor não encontrado nesta empresa.");
      const row = old
        ? await tx.department.update({ where: { id: old.id }, data })
        : await tx.department.create({
            data: { tenantId: req.user.tenantId, ...data },
          });
      if (row.modules.includes("CRM")) {
        const template = input.crmTemplate || "GENERAL";
        await tx.crmPipeline.upsert({
          where: { departmentId: row.id },
          create: {
            tenantId: req.user.tenantId,
            departmentId: row.id,
            name: "CRM · " + row.name,
            template,
            stages: pipelineStages(template),
            enabled: row.isActive,
          },
          update: {
            name: "CRM · " + row.name,
            enabled: row.isActive,
            ...(input.crmTemplate
              ? { template, stages: pipelineStages(template) }
              : {}),
          },
        });
      } else
        await tx.crmPipeline.updateMany({
          where: { tenantId: req.user.tenantId, departmentId: row.id },
          data: { enabled: false },
        });
      await tx.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.sub,
          action: "department.configured",
          entityType: "department",
          entityId: row.id,
          details: { modules: row.modules, isActive: row.isActive },
        },
      });
      return row;
    });
    this.events.publish(req.user.tenantId, "team.updated", {
      departmentId: result.id,
    });
    return result;
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() input: any) {
    return this.save(req, input || {});
  }
  @Patch(":id") update(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: any,
  ) {
    return this.save(req, input || {}, id);
  }
  @Delete(":id") remove(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.save(req, { isActive: false, modules: [] }, id);
  }
  @Get(":id/members") async members(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.admin(req);
    if (
      !(await this.prisma.department.findFirst({
        where: { id, tenantId: req.user.tenantId },
      }))
    )
      throw new BadRequestException("Setor não encontrado nesta empresa.");
    return (
      await this.prisma.departmentMember.findMany({
        where: { tenantId: req.user.tenantId, departmentId: id },
        select: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      })
    ).map((r) => r.user);
  }
  @Put(":id/members") async setMembers(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body("userIds") ids: unknown,
  ) {
    this.admin(req);
    if (
      !Array.isArray(ids) ||
      ids.length > 200 ||
      ids.some((x) => typeof x !== "string")
    )
      throw new BadRequestException("Selecione atendentes válidos.");
    const userIds = [...new Set(ids)];
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM departments WHERE id=${id}::uuid AND tenant_id=${req.user.tenantId}::uuid FOR UPDATE`;
      if (
        !(await tx.department.findFirst({
          where: { id, tenantId: req.user.tenantId },
        })) ||
        (await tx.membership.count({
          where: {
            tenantId: req.user.tenantId,
            userId: { in: userIds },
            user: { isActive: true },
          },
        })) !== userIds.length
      )
        throw new BadRequestException(
          "Setor ou atendente não pertence à empresa.",
        );
      await tx.departmentMember.deleteMany({
        where: { tenantId: req.user.tenantId, departmentId: id },
      });
      if (userIds.length)
        await tx.departmentMember.createMany({
          data: userIds.map((userId) => ({
            tenantId: req.user.tenantId,
            departmentId: id,
            userId,
          })),
        });
    });
    this.events.publish(req.user.tenantId, "team.updated", {
      departmentId: id,
    });
    return this.members(req, id);
  }
}
