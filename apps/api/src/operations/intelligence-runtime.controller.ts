import { BadRequestException, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { executableActions, executableKinds, RuntimeFlow, settings, validateRuntimeFlow } from '../ai/flow-runtime';
import { object } from './intelligence-runtime.service';

@Controller('chatbot/runtime')
@UseGuards(AuthGuard)
export class IntelligenceRuntimeController {
  constructor(private readonly prisma: PrismaService) {}
  private authorize(req: AuthenticatedRequest) {
    if (!['OWNER','ADMIN'].includes(req.user.role)) throw new ForbiddenException('Somente administradores podem publicar ou interromper o motor');
  }
  @Get()
  async status(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    const published = object(object(tenant.integrations).intelligencePublished);
    const executions = await this.prisma.auditLog.findMany({ where: { tenantId: req.user.tenantId, action: 'engine.processed' }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, createdAt: true, details: true } });
    return { engine: 'Véxora Intelligence Engine', active: published.active === true, revision: published.revision || null, publishedAt: published.publishedAt || null, flowName: published.flow?.name || null, executableKinds, executableActions, executions, llmExecution: true };
  }
  @Post('publish')
  async publish(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const root = object(tenant.integrations);
      const errors = validateRuntimeFlow(root.chatbotDraft);
      if (errors.length) throw new BadRequestException({ message: 'O fluxo ainda não pode ser publicado', errors });
      const flow = root.chatbotDraft as RuntimeFlow;
      const channels = await tx.channelConnection.findMany({ where: { tenantId: req.user.tenantId, id: { in: flow.channelIds }, isActive: true, provider: { in: ['WAHA','ZERNIO'] } } });
      if (channels.length !== flow.channelIds!.length) throw new BadRequestException('Todos os canais devem estar ativos e pertencer a esta empresa');
      for (const step of flow.steps) {
        const config = settings(step);
        if (step.kind === 'agent') {
          const assistant = object(root.assistant);
          const agent = Array.isArray(assistant.agents) ? assistant.agents.find((a: any) => a.id === config.agentId && a.enabled === true) : null;
          const selection = object(agent?.llm || assistant.llm);
          const configured = selection.provider === 'openrouter' ? !!process.env.OPENROUTER_API_KEY : selection.provider === 'openai' ? !!process.env.OPENAI_API_KEY : false;
          if (!assistant.enabled || !agent || !selection.model || !configured) throw new BadRequestException(`${step.title}: agente, modelo e provedor precisam estar habilitados e configurados`);
        }
        if (config.departmentKey && !await tx.department.findFirst({ where: { tenantId: req.user.tenantId, key: config.departmentKey, isActive: true } })) throw new BadRequestException(`${step.title}: equipe não encontrada nesta empresa`);
      }
      const publication = { revision: randomUUID(), active: true, publishedAt: new Date().toISOString(), flow };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: { ...root, intelligencePublished: publication } as Prisma.InputJsonValue } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: 'engine.published', entityType: 'chatbot', entityId: publication.revision, details: { channelIds: flow.channelIds!, name: flow.name } } });
      return { active: true, revision: publication.revision, publishedAt: publication.publishedAt };
    });
  }
  @Post('stop')
  async stop(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const root = object(tenant.integrations);
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: { ...root, intelligencePublished: { ...object(root.intelligencePublished), active: false } } } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: 'engine.stopped', entityType: 'chatbot' } });
    });
    return { active: false };
  }
}
