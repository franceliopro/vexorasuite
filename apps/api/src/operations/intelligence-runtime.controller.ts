import { WEB_DESIGNER_AGENT_ID } from "../ai/web-designer-agent";
import { AuditCovered } from "../common/audit/audit.decorator";
import {isUUID} from 'class-validator';
import {automationPublicationKey,isAutomationPublicationKey,publicationKey,RuntimeScope} from './runtime-scope';
import {resolveEntitlements} from '../auth/entitlements';
import { isSchedulerWorkerAlive } from '../common/worker-health';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { executableActions, executableKinds, RuntimeFlow, normalize, settings, validateRuntimeFlow } from '../ai/flow-runtime';
import { object } from './intelligence-runtime.service';
import { economicalProviders } from '../ai/economical-providers';

type PublishTarget = RuntimeScope & {flowId?:string};

@AuditCovered()
@Controller('chatbot/runtime')
@UseGuards(AuthGuard)
export class IntelligenceRuntimeController {
  constructor(private readonly prisma: PrismaService) {}
  private authorize(req: AuthenticatedRequest) {
    if (!['OWNER','ADMIN'].includes(req.user.role)) throw new ForbiddenException('Somente administradores podem publicar ou interromper o motor');
  }
  private namedKey(value:unknown){
    if(value===undefined)return null;
    if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(value))throw new BadRequestException('Identificador de fluxo inválido.');
    return automationPublicationKey(value);
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
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true, entitlements: true } });
    const root = object(tenant.integrations);
    const published = object(root.intelligencePublished);
    const draftMatches = (publication: any) => Boolean(publication?.flow && root.chatbotDraft && isDeepStrictEqual(publication.flow, root.chatbotDraft));
    const executions = await this.prisma.auditLog.findMany({ where: { tenantId: req.user.tenantId, action: 'engine.processed' }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, createdAt: true, details: true } });
    const publications=Object.entries(object(object(tenant.integrations).intelligencePublications)).map(([key,raw]:[string,any])=>{const p=object(raw);return {key,scope:p.scope,active:p.source === 'ui' && p.active === true,revision:p.revision,flowName:p.flow?.name,draftMatchesPublication:draftMatches(p),...(isAutomationPublicationKey(key)?{flowId:key.slice('automation:'.length),channelIds:p.flow?.channelIds||[],triggers:p.flow?.triggers||[]}: {})};});
    const defaultActive=published.source === 'ui' && published.active === true;
    const active=defaultActive||publications.some(publication=>publication.active);
    const workerAlive = await isSchedulerWorkerAlive(this.prisma as any);
    return { engine: 'Véxora Intelligence Engine', active, revision: published.source === 'ui' ? published.revision || null : null, publishedAt: published.source === 'ui' ? published.publishedAt || null : null, flowName: published.source === 'ui' ? published.flow?.name || null : null, executableKinds, executableActions, executions, publications, botLimit:resolveEntitlements(tenant.entitlements).bots, draftMatchesPublication: draftMatches(published), llmExecution: true, scheduler: { mode: (process.env.SCHEDULER_MODE || 'in-process'), workerAlive } };
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
  async publish(@Req() req: AuthenticatedRequest,@Body() body:PublishTarget={}) {
    this.authorize(req);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true, entitlements: true } });
      const root = object(tenant.integrations);
      const scope=await this.scope(tx,req,body);
      const namedKey=this.namedKey(body.flowId);
      const key=namedKey||publicationKey(scope);
      const publications=object(root.intelligencePublications);
      const savedFlows=object(root.businessFlows);
      if(namedKey&&(!body.flowId||!Object.hasOwn(savedFlows,body.flowId)))throw new BadRequestException('Salve o fluxo na biblioteca antes de ativá-lo.');
      const draft=namedKey?savedFlows[body.flowId!]?.draft:root.chatbotDraft;
      const errors = validateRuntimeFlow(draft);
      if (errors.length) throw new BadRequestException({ message: 'O fluxo ainda não pode ser publicado', errors });
      const flow = draft as RuntimeFlow;
      const current=object(key==='default'?root.intelligencePublished:publications[key]);
      const activeCount=[root.intelligencePublished,...Object.values(publications)].filter(item=>object(item).source==='ui'&&object(item).active===true).length;
      const limit=resolveEntitlements(tenant.entitlements).bots;
      if(current.active!==true&&activeCount>=limit)throw new BadRequestException(`Seu plano permite ${limit} chatbots ativos. Pause um fluxo antes de ativar outro.`);
      if(namedKey){
        const triggerKey=(trigger:NonNullable<RuntimeFlow['triggers']>[number])=>trigger.kind==='keyword'?'keyword:'+normalize(trigger.keyword||''):trigger.kind==='first_message'?'first_message':'message';
        const triggers=new Set((flow.triggers||[]).map(triggerKey));
        const overlap=Object.entries(publications).some(([otherKey,raw])=>{
          const other=object(raw);
          return otherKey!==key&&isAutomationPublicationKey(otherKey)&&other.active===true&&publicationKey(other.scope)===publicationKey(scope)&&other.flow?.channelIds?.some((id:string)=>flow.channelIds?.includes(id))&&Array.isArray(other.flow?.triggers)&&other.flow.triggers.some((trigger:NonNullable<RuntimeFlow['triggers']>[number])=>triggers.has(triggerKey(trigger)));
        });
        if(overlap)throw new BadRequestException('Já existe uma automação ativa com o mesmo gatilho neste canal e destino.');
      }
      const channels = await tx.channelConnection.findMany({ where: { tenantId: req.user.tenantId, id: { in: flow.channelIds }, isActive: true, provider: { in: ['WAHA','ZERNIO'] } } });
      if (channels.length !== flow.channelIds!.length) throw new BadRequestException('Todos os canais devem estar ativos e pertencer a esta empresa');
      for (const step of flow.steps) {
        const config = settings(step);
        if (step.kind === 'agent') {
          const assistant = object(root.assistant);
          const agent = Array.isArray(assistant.agents) ? assistant.agents.find((a: any) => String(config.agentId) !== WEB_DESIGNER_AGENT_ID && a.id === config.agentId && a.enabled === true) : null;
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
  async stop(@Req() req: AuthenticatedRequest,@Body() body:PublishTarget={}) {
    this.authorize(req);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true, entitlements: true } });
      const root = object(tenant.integrations);
      const scope=await this.scope(tx,req,body);
      const namedKey=this.namedKey(body.flowId);
      const key=namedKey||publicationKey(scope);
      const publications=object(root.intelligencePublications);
      if(namedKey&&!Object.hasOwn(publications,key))throw new BadRequestException('Automação não encontrada nesta empresa.');
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: key==='default'?{...root,intelligencePublished:{...object(root.intelligencePublished),active:false}}:{...root,intelligencePublications:{...publications,[key]:{...object(publications[key]),active:false}}} } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: 'engine.stopped', entityType: 'chatbot',details:{scope,key} } });
    });
    return { active: false };
  }
}


