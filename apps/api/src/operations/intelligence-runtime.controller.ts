import {isUUID} from 'class-validator';
import {publicationKey,RuntimeScope} from './runtime-scope';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
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
  private async scope(tx:any,req:AuthenticatedRequest,body:RuntimeScope={}){
    if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('Destino inválido.');
    const scope:RuntimeScope={};
    if(body.departmentId!=null){
      if(!isUUID(body.departmentId)||!await tx.department.findFirst({where:{id:body.departmentId,tenantId:req.user.tenantId,isActive:true}}))throw new BadRequestException('Departamento não disponível nesta empresa.');
      scope.departmentId=body.departmentId;
    }
    if(body.userId!=null){
      if(!isUUID(body.userId)||!await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:body.userId,user:{isActive:true}},select:{id:true}}))throw new BadRequestException('Atendente não disponível nesta empresa.');
      if(scope.departmentId&&!await tx.departmentMember.findFirst({where:{tenantId:req.user.tenantId,userId:body.userId,departmentId:scope.departmentId},select:{id:true}}))throw new BadRequestException('Atendente não pertence ao departamento.');
      scope.userId=body.userId;
    }
    return scope;
  }
  @Get()
  async status(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    const published = object(object(tenant.integrations).intelligencePublished);
    const executions = await this.prisma.auditLog.findMany({ where: { tenantId: req.user.tenantId, action: 'engine.processed' }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, createdAt: true, details: true } });
    return { engine: 'Véxora Intelligence Engine', active: published.source === 'ui' && published.active === true, revision: published.revision || null, publishedAt: published.publishedAt || null, flowName: published.flow?.name || null, executableKinds, executableActions, executions, publications: Object.entries(object(object(tenant.integrations).intelligencePublications)).map(([key,p]:[string,any])=>({key,scope:p.scope,active:p.source === 'ui' && p.active === true,revision:p.revision,flowName:p.flow?.name})), llmExecution: true };
  }
  @Get('destinations')
  async destinations(@Req() req:AuthenticatedRequest){
    this.authorize(req);
    const [departments,memberships]=await Promise.all([
      this.prisma.department.findMany({where:{tenantId:req.user.tenantId,isActive:true},select:{id:true,key:true,name:true,routingCategory:true,members:{where:{tenantId:req.user.tenantId,user:{isActive:true}},select:{userId:true}}},orderBy:{name:'asc'}}),
      this.prisma.membership.findMany({where:{tenantId:req.user.tenantId,user:{isActive:true}},select:{user:{select:{id:true,name:true}}}}),
    ]);
    return {departments:departments.map(d=>({...d,members:d.members.map(m=>m.userId)})),agents:memberships.map(m=>m.user).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))};
  }
  @Post('publish')
  async publish(@Req() req: AuthenticatedRequest,@Body() body:RuntimeScope={}) {
    this.authorize(req);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const root = object(tenant.integrations);
      const scope=await this.scope(tx,req,body);
      const key=publicationKey(scope);
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
      const publication = { revision: randomUUID(), active: true, source: 'ui' as const, publishedAt: new Date().toISOString(), flow, scope };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: key==='default'?{...root,intelligencePublished:publication}:{...root,intelligencePublications:{...object(root.intelligencePublications),[key]:publication}} as Prisma.InputJsonValue } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: 'engine.published', entityType: 'chatbot', entityId: publication.revision, details: { channelIds: flow.channelIds!, name: flow.name,scope,key } } });
      return { active: true, revision: publication.revision, publishedAt: publication.publishedAt, scope,key };
    });
  }
  @Post('stop')
  async stop(@Req() req: AuthenticatedRequest,@Body() body:RuntimeScope={}) {
    this.authorize(req);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const root = object(tenant.integrations);
      await this.scope(tx,req,body);
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: publicationKey(body)==='default'?{...root,intelligencePublished:{...object(root.intelligencePublished),active:false}}:{...root,intelligencePublications:{...object(root.intelligencePublications),[publicationKey(body)]:{...object(object(root.intelligencePublications)[publicationKey(body)]),active:false}}} } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: 'engine.stopped', entityType: 'chatbot',details:{scope:body,key:publicationKey(body)} } });
    });
    return { active: false };
  }
}


