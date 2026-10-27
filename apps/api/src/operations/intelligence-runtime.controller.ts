import { BadRequestException, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { executableActions, executableKinds, RuntimeFlow, settings, validateRuntimeFlow } from '../ai/flow-runtime';
import { object } from './intelligence-runtime.service';
import { economicalProviders } from '../ai/economical-providers';

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
  @Get('destinations')
  async destinations(@Req() req:AuthenticatedRequest){
    this.authorize(req);
    const [departments,memberships]=await Promise.all([
      this.prisma.department.findMany({where:{tenantId:req.user.tenantId,isActive:true},select:{id:true,key:true,name:true,members:{where:{tenantId:req.user.tenantId,user:{isActive:true}},select:{userId:true}}},orderBy:{name:'asc'}}),
      this.prisma.membership.findMany({where:{tenantId:req.user.tenantId,user:{isActive:true}},select:{user:{select:{id:true,name:true}}}}),
    ]);
    return {departments:departments.map(d=>({...d,members:d.members.map(m=>m.userId)})),agents:memberships.map(m=>m.user).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))};
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
          const configured = economicalProviders(assistant,selection,root,req.user.tenantId).length>0;
          if (!assistant.enabled || !agent || !configured) throw new BadRequestException(`${step.title}: agente, modelo e provedor precisam estar habilitados e configurados`);
        }
        if (config.departmentKey && !await tx.department.findFirst({ where: { tenantId: req.user.tenantId, key: config.departmentKey, isActive: true } })) throw new BadRequestException(`${step.title}: equipe não encontrada nesta empresa`);
        if(config.userId){
          if(!await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:config.userId,user:{isActive:true}},select:{id:true}}))throw new BadRequestException(`${step.title}: atendente não disponível nesta empresa`);
          if(config.departmentKey&&!await tx.departmentMember.findFirst({where:{tenantId:req.user.tenantId,userId:config.userId,department:{key:config.departmentKey,isActive:true}},select:{id:true}}))throw new BadRequestException(`${step.title}: o atendente não pertence ao time selecionado`);
        }
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
