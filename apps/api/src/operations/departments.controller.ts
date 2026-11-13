import { AuditCovered } from "../common/audit/audit.decorator";
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
/** Utilidades de nome/chave únicos e de duplicação de setor. */
const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ");
const nextFreeName = (base: string, taken: string[]): string => {
  const norm = normalizeName(base);
  const takenLower = new Set(taken.map((n) => n.toLowerCase()));
  if (!takenLower.has(norm.toLowerCase())) return norm;
  for (let n = 2; n <= 99; n += 1) {
    const candidate = norm + " " + n;
    if (!takenLower.has(candidate.toLowerCase())) return candidate;
  }
  return norm + " " + Date.now().toString(36);
};
const nextFreeKey = (base: string, taken: string[]): string => {
  const cleaned = normalizeName(base).toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 38) || "SETOR";
  const takenLower = new Set(taken.map((k) => k.toLowerCase()));
  if (!takenLower.has(cleaned.toLowerCase())) return cleaned;
  for (let n = 2; n <= 99; n += 1) {
    const candidate = cleaned + "_" + n;
    if (!takenLower.has(candidate.toLowerCase())) return candidate;
  }
  return cleaned + "_" + Date.now().toString(36).toUpperCase();
};

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
@AuditCovered()
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
      if (data.name !== undefined) {
        const siblingNames = (await tx.department.findMany({ where: { tenantId: req.user.tenantId }, select: { name: true } })).map((d) => d.name);
        const clash = siblingNames.find((n) => n.toLowerCase() === String(data.name).toLowerCase() && (!old || n.toLowerCase() !== old.name.toLowerCase()));
        if (clash && id) throw new BadRequestException(`Já existe um setor chamado "${clash}". Escolha outro nome.`);
        data.name = id ? normalizeName(String(data.name)) : nextFreeName(String(data.name), siblingNames);
      }
      if (data.key !== undefined) {
        const siblingKeys = (await tx.department.findMany({ where: { tenantId: req.user.tenantId }, select: { key: true } })).map((d) => d.key);
        const clash = siblingKeys.find((k) => k.toLowerCase() === String(data.key).toLowerCase() && (!old || k.toLowerCase() !== old.key.toLowerCase()));
        if (clash && id) throw new BadRequestException(`A chave "${clash}" já está em uso. Escolha outra.`);
        if (clash && !id) data.key = nextFreeKey(String(data.key), siblingKeys);
      }
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
  @Post(":id/purge") async purge(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { confirmation?: unknown },
  ) {
    if (!administrative(req.user.role)) throw new ForbiddenException("Somente administradores podem excluir o setor da empresa.");
    if (body?.confirmation !== "EXCLUIR-SETOR") throw new BadRequestException("Digite EXCLUIR-SETOR para confirmar.");
    const result = await this.prisma.$transaction(async (tx) => {
      const department = await tx.department.findFirst({ where: { id, tenantId: req.user.tenantId }, select: { id: true, name: true } });
      if (!department) throw new BadRequestException("Setor não encontrado nesta empresa.");
      const pipeline = await tx.crmPipeline.findUnique({ where: { departmentId: department.id }, select: { id: true } });
      // detach contacts from the pipeline so we can delete it (schema sets onDelete: Restrict)
      if (pipeline) await tx.contact.updateMany({ where: { tenantId: req.user.tenantId, pipelineId: pipeline.id }, data: { pipelineId: null } });
      if (pipeline) await tx.crmPipeline.delete({ where: { id: pipeline.id } });
      // calendar assignments reference departmentId but have no FK; remove explicitly
      await tx.calendarAssignment.deleteMany({ where: { tenantId: req.user.tenantId, departmentId: department.id } });
      // conversations: schema onDelete SetNull — automatic
      // members: cascade from department delete
      // tasks/workflows stored as JSON config — no FK, remain intact
      const deleted = await tx.department.delete({ where: { id: department.id } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "department.purged", entityType: "department", entityId: department.id, details: { name: department.name, pipelineId: pipeline?.id ?? null } } });
      return { deleted: deleted.name };
    });
    this.events.publish(req.user.tenantId, "team.updated", { departmentId: id, purged: true });
    return result;
  }

  /**
   * Duplica um setor inteiro: nome/chave únicos, módulos, membros, funil de CRM,
   * workflows internos e agendas vinculadas. Ideal para "Financeiro 2".
   */
  @Post(":id/duplicate") async duplicate(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: any) {
    this.admin(req);
    const tenantId = req.user.tenantId;
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id=${tenantId}::uuid FOR UPDATE`;
      const source = await tx.department.findFirst({ where: { id, tenantId }, include: { pipeline: { select: { template: true } } } });
      if (!source) throw new BadRequestException("Setor não encontrado nesta empresa.");
      const siblings = await tx.department.findMany({ where: { tenantId }, select: { name: true, key: true } });
      const requestedName = typeof body?.name === "string" && body.name.trim() ? normalizeName(body.name).slice(0, 80) : null;
      const requestedKey = typeof body?.key === "string" && body.key.trim() ? body.key.trim().toUpperCase().slice(0, 38) : null;
      if (requestedKey && !/^[A-Z0-9_-]+$/.test(requestedKey)) throw new BadRequestException("Use uma chave com letras maiúsculas, números e sublinhado.");
      const name = requestedName ? nextFreeName(requestedName, siblings.map(s => s.name)) : nextFreeName(source.name, siblings.map(s => s.name));
      const key = requestedKey ? nextFreeKey(requestedKey, siblings.map(s => s.key)) : nextFreeKey(source.key, siblings.map(s => s.key));
      const created = await tx.department.create({ data: { tenantId, name, key, keywords: source.keywords, modules: source.modules, routingCategory: source.routingCategory, routingPlatform: source.routingPlatform, routingStrategy: source.routingStrategy, maxOpenConversations: source.maxOpenConversations, isActive: source.isActive } });
      const memberRows = await tx.departmentMember.findMany({ where: { tenantId, departmentId: source.id }, select: { userId: true } });
      if (memberRows.length) await tx.departmentMember.createMany({ data: memberRows.map(r => ({ tenantId, departmentId: created.id, userId: r.userId })) });
      if (source.modules.includes("CRM")) {
        const template = source.pipeline?.template && Object.hasOwn(PIPELINE_TEMPLATES, source.pipeline.template) ? source.pipeline.template as keyof typeof PIPELINE_TEMPLATES : "GENERAL";
        await tx.crmPipeline.create({ data: { tenantId, departmentId: created.id, name: "CRM · " + created.name, template, stages: pipelineStages(template), enabled: created.isActive } });
      }
      const workflows = await tx.$queryRawUnsafe<{ id: string; name: string; trigger: string; timezone: string; repeatDays: number; filters: any; steps: any }[]>(
        "SELECT id, name, trigger, timezone, repeat_days AS \"repeatDays\", filters, steps FROM internal_workflows WHERE tenant_id = $1::uuid AND filters->>'departmentId' = $2",
        tenantId, source.id,
      );
      for (const workflow of workflows) {
        await tx.internalWorkflow.create({ data: { tenantId, userId: req.user.sub, name: (String(workflow.name).replace(source.name, "").trim() ? workflow.name.replace(source.name, created.name) : workflow.name + " · " + created.name).slice(0, 120), enabled: false, trigger: workflow.trigger, timezone: workflow.timezone, nextRunAt: new Date(), repeatDays: workflow.repeatDays, filters: { ...(workflow.filters as any), departmentId: created.id }, steps: workflow.steps as any } });
      }
      const assignments = await tx.calendarAssignment.findMany({ where: { tenantId, departmentId: source.id } });
      if (assignments.length) await tx.calendarAssignment.createMany({ data: assignments.map(a => ({ tenantId, accountId: a.accountId, calendarId: a.calendarId, userId: null, departmentId: created.id })) });
      await tx.auditLog.create({ data: { tenantId, userId: req.user.sub, action: "department.duplicated", entityType: "department", entityId: created.id, details: { sourceId: source.id, name: created.name, key: created.key, members: memberRows.length, workflows: workflows.length, calendars: assignments.length } } });
      return created;
    });
    this.events.publish(tenantId, "team.updated", { departmentId: result.id, duplicated: true });
    return result;
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
