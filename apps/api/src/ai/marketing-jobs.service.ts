import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AssistantAutomationService } from './assistant-automation.service';
import { MarketingLibraryService } from './marketing-library.service';
import { VideoRenderService } from './video-render.service';
import { VoiceService } from './voice.service';
const object=(v:any):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
export type MarketingInput={question:string;format:'POST'|'CAROUSEL'|'VIDEO';channelId?:string;scheduledFor?:string;publish?:boolean;narrate?:boolean;agentId?:string;useBrandOnly?:boolean};
export function marketingInput(input:any):MarketingInput {
 if(!input||typeof input.question!=='string'||!input.question.trim()||input.question.length>2000||!['POST','CAROUSEL','VIDEO'].includes(input.format))throw new BadRequestException('Informe tema e formato válidos.');
 for(const key of ['publish','narrate','useBrandOnly'])if(input[key]!==undefined&&typeof input[key]!=='boolean')throw new BadRequestException('Opção inválida.');
 if(input.channelId!==undefined&&!isUUID(input.channelId))throw new BadRequestException('Canal inválido.');
 if(input.agentId!==undefined&&(typeof input.agentId!=='string'||input.agentId.length>80))throw new BadRequestException('Agente inválido.');
 if(input.scheduledFor!==undefined&&(typeof input.scheduledFor!=='string'||!/(Z|[+-]\d{2}:\d{2})$/i.test(input.scheduledFor)||!Number.isFinite(Date.parse(input.scheduledFor))||Date.parse(input.scheduledFor)<Date.now()+120000||Date.parse(input.scheduledFor)>Date.now()+90*86400000))throw new BadRequestException('Agende de 2 minutos a 90 dias à frente, com fuso.');
 return {question:input.question.trim(),format:input.format,...(input.channelId?{channelId:input.channelId}:{}),...(input.scheduledFor?{scheduledFor:input.scheduledFor}:{}),...(input.publish!==undefined?{publish:input.publish}:{}),...(input.narrate!==undefined?{narrate:input.narrate}:{}),...(input.useBrandOnly!==undefined?{useBrandOnly:input.useBrandOnly}:{}),...(input.agentId?{agentId:input.agentId}:{})};
}
@Injectable()
export class MarketingJobsService implements OnModuleInit,OnModuleDestroy {
 private readonly logger=new Logger(MarketingJobsService.name);private timer?:NodeJS.Timeout;private running=false;private stopped=false;
 constructor(private readonly prisma:PrismaService,private readonly automation:AssistantAutomationService,private readonly library:MarketingLibraryService,private readonly video:VideoRenderService,private readonly voice:VoiceService){}
 onModuleInit(){this.timer=setInterval(()=>void this.tick(),10000);this.timer.unref();}
 onModuleDestroy(){this.stopped=true;if(this.timer)clearInterval(this.timer);}
 authorize(req:AuthenticatedRequest){this.automation.authorize(req);}
 async context(tenantId:string,userId:string):Promise<AuthenticatedRequest>{
  const membership=await this.prisma.membership.findFirst({where:{tenantId,userId,role:{in:['OWNER','ADMIN']},tenant:{status:'ACTIVE'},user:{isActive:true}},include:{tenant:true}});
  if(!membership)throw new ForbiddenException('A autorização do responsável pelo workflow foi revogada.');
  const assistant=object(object(membership.tenant.integrations).assistant);if(!assistant.enabled)throw new ForbiddenException('Habilite a assistente para executar automações.');
  return {user:{tenantId,sub:userId,tenantSlug:membership.tenant.slug,role:membership.role}} as AuthenticatedRequest;
 }
 private async target(req:AuthenticatedRequest,input:MarketingInput){
  const config=await this.library.config(req);const publish=input.publish??config.autoPublish===true;
  const channels=await this.prisma.channelConnection.findMany({where:{tenantId:req.user.tenantId,provider:'ZERNIO',isActive:true,status:'CONNECTED'}});
  const eligible=channels.filter(c=>['instagram','facebook'].includes(String(object(c.settings).platform).toLowerCase()));
  const named=eligible.filter(c=>c.name.length>=3&&input.question.toLocaleLowerCase('pt-BR').includes(c.name.toLocaleLowerCase('pt-BR')));
  const channel=input.channelId?eligible.find(c=>c.id===input.channelId):named.length===1?named[0]:eligible.length===1?eligible[0]:undefined;
  if(publish&&!channel)throw new BadRequestException('Escolha uma única conta social conectada para publicar.');
  return {...input,publish,...(channel?{channelId:channel.id}:{})};
 }
 private async assertAgent(req:AuthenticatedRequest,input:MarketingInput,workflow=false){if(!input.agentId)return;const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId}});const agent=object(object(tenant.integrations).assistant).agents?.find((a:any)=>a.id===input.agentId&&a.enabled);const needed=['web.research',...(!input.useBrandOnly?['drive.files.search']:[]),'media.carousel.generate',...(input.format==='VIDEO'?['media.video.render']:[]),...(input.narrate?['voice.tts']:[]),...(input.publish?['social.publish']:[]),...(workflow?['marketing.workflow.run']:[])];if(!agent||needed.some(skill=>!agent.allowedActions?.includes(skill)))throw new ForbiddenException('Agente sem as Skills necessárias para esta execução: '+needed.join(', '));}
 async enqueue(req:AuthenticatedRequest,value:any,requestKey:string=randomUUID()){
  this.authorize(req);if(!isUUID(requestKey))throw new BadRequestException('Identificador de solicitação inválido.');
  await this.context(req.user.tenantId,req.user.sub);const input=await this.target(req,marketingInput(value));await this.assertAgent(req,input);
  const job=await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
   const existing=await tx.marketingJob.findUnique({where:{tenantId_requestKey:{tenantId:req.user.tenantId,requestKey}}});if(existing)return existing;
   if(await tx.marketingJob.count({where:{tenantId:req.user.tenantId,status:{in:['QUEUED','RUNNING','PUBLISHING','CANCEL_REQUESTED']}}})>=20)throw new BadRequestException('Aguarde as execuções em andamento antes de criar mais trabalhos.');
   return tx.marketingJob.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,requestKey,payload:input as unknown as Prisma.InputJsonValue}});
  });
  return {answer:'Solicitação registrada. A Véxora vai pesquisar, sincronizar referências, criar e '+(input.publish?(input.scheduledFor?'agendar.':'publicar.'):'preparar o rascunho.'),job:{id:job.id,status:job.status},usedAi:false,tokensUsed:0};
 }
 async list(req:AuthenticatedRequest){this.authorize(req);return this.prisma.marketingJob.findMany({where:{tenantId:req.user.tenantId},orderBy:{createdAt:'desc'},take:50});}
 async syncLibrary(req:AuthenticatedRequest){
  this.authorize(req);await this.context(req.user.tenantId,req.user.sub);
  const job=await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
   if(await tx.marketingJob.count({where:{tenantId:req.user.tenantId,status:{in:['QUEUED','RUNNING','PUBLISHING','CANCEL_REQUESTED']}}})>=20)throw new BadRequestException('Aguarde as execuções em andamento antes de sincronizar.');
   return tx.marketingJob.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,requestKey:randomUUID(),payload:{type:'LIBRARY_SYNC',question:'Sincronizar biblioteca do Drive'}}});
  });return {job:{id:job.id,status:job.status},answer:'Sincronização registrada.'};
 }
 async read(req:AuthenticatedRequest,id:string){this.authorize(req);const job=await this.prisma.marketingJob.findFirst({where:{id,tenantId:req.user.tenantId}});if(!job)throw new NotFoundException('Execução não encontrada.');return job;}
 async cancel(req:AuthenticatedRequest,id:string){
  this.authorize(req);
  await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM marketing_jobs WHERE id=${id}::uuid AND tenant_id=${req.user.tenantId}::uuid FOR UPDATE`;
   const job=await tx.marketingJob.findFirst({where:{id,tenantId:req.user.tenantId}});if(!job)throw new NotFoundException('Execução não encontrada.');
   if(job.status==='PUBLISHING')throw new BadRequestException('O envio à rede social já começou. Confira a publicação na Zernio; cancelar esta execução não desfaz esse envio.');
   if(job.status==='QUEUED')await tx.marketingJob.update({where:{id},data:{status:'CANCELLED',completedAt:new Date()}});
   else if(job.status==='RUNNING')await tx.marketingJob.update({where:{id},data:{status:'CANCEL_REQUESTED'}});
  });return this.read(req,id);
 }
 async workflows(req:AuthenticatedRequest){this.authorize(req);return this.prisma.marketingWorkflow.findMany({where:{tenantId:req.user.tenantId},orderBy:{createdAt:'desc'},take:50});}
 async saveWorkflow(req:AuthenticatedRequest,value:any){
  this.authorize(req);await this.context(req.user.tenantId,req.user.sub);
  const input=await this.target(req,marketingInput(value));
  await this.assertAgent(req,input,true);
  if(typeof value.name!=='string'||!value.name.trim()||value.name.length>120||typeof value.nextRunAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/i.test(value.nextRunAt)||!Number.isFinite(Date.parse(value.nextRunAt))||Date.parse(value.nextRunAt)<Date.now()+60000||Date.parse(value.nextRunAt)>Date.now()+90*86400000||!Number.isInteger(value.everyDays)||value.everyDays<0||value.everyDays>30)throw new BadRequestException('Configure nome, próxima execução futura e recorrência de 0 a 30 dias.');
  if(input.scheduledFor)throw new BadRequestException('Use a próxima execução do workflow; o horário da publicação será a execução.');
  return this.prisma.marketingWorkflow.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,name:value.name.trim(),payload:input as unknown as Prisma.InputJsonValue,nextRunAt:new Date(value.nextRunAt),everyDays:value.everyDays}});
 }
 async toggle(req:AuthenticatedRequest,id:string,enabled:boolean){
  this.authorize(req);if(typeof enabled!=='boolean')throw new BadRequestException('Estado inválido.');
  if(enabled)await this.context(req.user.tenantId,req.user.sub);
  return this.prisma.$transaction(async tx=>{
   // Scheduler and pause use the same lock: no new run can appear after pause completes.
   await tx.$queryRaw`SELECT id FROM marketing_workflows WHERE id=${id}::uuid AND tenant_id=${req.user.tenantId}::uuid FOR UPDATE`;
   const row=await tx.marketingWorkflow.findFirst({where:{id,tenantId:req.user.tenantId}});if(!row)throw new NotFoundException();
   const workflow=await tx.marketingWorkflow.update({where:{id},data:{enabled}});
   if(enabled)return {...workflow,cancelledJobs:0,cancellationRequested:0,alreadyPublishing:0};
   const where={tenantId:req.user.tenantId,requestKey:{startsWith:'workflow:'+id+':'}};
   const queued=await tx.marketingJob.updateMany({where:{...where,status:'QUEUED'},data:{status:'CANCELLED',completedAt:new Date()}});
   const running=await tx.marketingJob.updateMany({where:{...where,status:'RUNNING'},data:{status:'CANCEL_REQUESTED'}});
   const alreadyPublishing=await tx.marketingJob.count({where:{...where,status:'PUBLISHING'}});
   return {...workflow,cancelledJobs:queued.count,cancellationRequested:running.count,alreadyPublishing};
  });
 }
 private async schedule(){
  await this.prisma.$transaction(async tx=>{
   const workflows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM marketing_workflows WHERE enabled = true AND next_run_at <= NOW() ORDER BY next_run_at LIMIT 10 FOR UPDATE SKIP LOCKED`;
   for(const item of workflows){const workflow=await tx.marketingWorkflow.findUniqueOrThrow({where:{id:item.id}});const key='workflow:'+workflow.id+':'+workflow.nextRunAt.toISOString();
    await tx.marketingJob.upsert({where:{tenantId_requestKey:{tenantId:workflow.tenantId,requestKey:key}},create:{tenantId:workflow.tenantId,userId:workflow.userId,requestKey:key,payload:workflow.payload as Prisma.InputJsonValue},update:{}});
    const interval=workflow.everyDays*86400000;const next=interval?new Date(workflow.nextRunAt.getTime()+Math.max(1,Math.floor((Date.now()-workflow.nextRunAt.getTime())/interval)+1)*interval):workflow.nextRunAt;
    await tx.marketingWorkflow.update({where:{id:workflow.id},data:{nextRunAt:next,...(!interval?{enabled:false}:{})}});
   }
  });
 }
 async tick(){
  if(this.running||this.stopped)return;this.running=true;
  try{
   await this.schedule();
   // A crashed run may already have reached the provider. Never replay it blindly.
   await this.prisma.marketingJob.updateMany({where:{status:{in:['RUNNING','PUBLISHING']},startedAt:{lt:new Date(Date.now()-10*60000)}},data:{status:'NEEDS_REVIEW',error:'Execução interrompida. Verifique a criação e a Zernio antes de repetir.',completedAt:new Date()}});
   await this.prisma.marketingJob.updateMany({where:{status:'CANCEL_REQUESTED',startedAt:{lt:new Date(Date.now()-10*60000)}},data:{status:'CANCELLED',completedAt:new Date()}});
   const job=await this.prisma.$transaction(async tx=>{const rows=await tx.$queryRaw<{id:string}[]>`SELECT id FROM marketing_jobs WHERE status = 'QUEUED' AND run_at <= NOW() ORDER BY run_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED`;if(!rows.length)return null;return tx.marketingJob.update({where:{id:rows[0]!.id},data:{status:'RUNNING',startedAt:new Date()}});});
   if(!job)return;
   let leaseLost=false;
   const heartbeat=setInterval(()=>{void this.prisma.marketingJob.updateMany({where:{id:job.id,status:{in:['RUNNING','PUBLISHING','CANCEL_REQUESTED']}},data:{startedAt:new Date()}}).catch(()=>{leaseLost=true})},30000);heartbeat.unref();
   let sending=false;
   const ensureRunning=async()=>{if(leaseLost||!await this.prisma.marketingJob.findFirst({where:{id:job.id,status:'RUNNING'}}))throw new BadRequestException('A execução foi interrompida antes da próxima etapa.');};
   try{
    const req=await this.context(job.tenantId,job.userId);const input=object(job.payload) as MarketingInput;
    if(object(job.payload).type==='LIBRARY_SYNC'){const result=await this.library.sync(req,true);await this.prisma.marketingJob.updateMany({where:{id:job.id,status:'RUNNING'},data:{status:'COMPLETED',completedAt:new Date(),result}});return;}
    await this.assertAgent(req,input,job.requestKey.startsWith('workflow:'));
    if(!input.useBrandOnly)await this.library.sync(req);
    await ensureRunning();
    const created:any=await this.automation.createCarousel(req,input.question,{format:input.format,draftOnly:true,agentId:input.agentId,useBrandOnly:input.useBrandOnly===true,referenceScope:input.useBrandOnly?undefined:await this.library.config(req) as {accountId:string;fileIds:string[]}});
    const id=created.automation.id;
    await this.prisma.marketingJob.update({where:{id:job.id},data:{result:{automationId:id,format:input.format} as Prisma.InputJsonValue}});
    await ensureRunning();
    if(input.format==='VIDEO'){
     const record=await this.automation.read(req,id);const data=object(record.details);
     const buffers=await this.automation.videoScenes(req,id);
     await ensureRunning();
     const narration=input.narrate?await this.voice.speak(req,data.carousel.slides.map((s:any)=>s.title+'. '+s.body).join(' ').slice(0,700),input.agentId):undefined;
     await ensureRunning();
     const video=await this.video.render(req.user.tenantId,id,buffers,narration);
     await this.prisma.auditLog.update({where:{id:record.id},data:{details:{...data,status:'DRAFT',video}}});
    }
    await this.context(job.tenantId,job.userId);
    await this.assertAgent(req,input,job.requestKey.startsWith('workflow:'));
    const stillRunning=await this.prisma.marketingJob.findFirst({where:{id:job.id,status:'RUNNING'}});if(!stillRunning||leaseLost)throw new BadRequestException('A execução foi interrompida antes da publicação.');
    if(input.publish){
     // This atomic transition is the boundary after which an external send cannot be cancelled locally.
     const claim=await this.prisma.marketingJob.updateMany({where:{id:job.id,status:'RUNNING'},data:{status:'PUBLISHING',startedAt:new Date()}});
     if(!claim.count)throw new BadRequestException('A execução foi cancelada antes do envio.');sending=true;
    }
    const publication=input.publish?await this.automation.publish(req,id,{channelId:input.channelId,scheduledFor:input.scheduledFor}):null;
    await this.prisma.marketingJob.updateMany({where:{id:job.id,status:sending?'PUBLISHING':'RUNNING'},data:{status:'COMPLETED',completedAt:new Date(),result:{automationId:id,format:input.format,...(publication?{publication}:{}),sources:created.sources||[]} as Prisma.InputJsonValue}});
   }catch(error){await this.prisma.marketingJob.updateMany({where:{id:job.id,status:{in:['RUNNING','PUBLISHING']}},data:{status:sending?'NEEDS_REVIEW':'FAILED',error:((sending?'Confira a publicação na Zernio antes de repetir. ':'')+(error instanceof Error?error.message:'Falha na execução')).slice(0,500),completedAt:new Date()}});}finally{clearInterval(heartbeat);await this.prisma.marketingJob.updateMany({where:{id:job.id,status:'CANCEL_REQUESTED'},data:{status:'CANCELLED',completedAt:new Date()}});}
  }catch{this.logger.error('Falha na verificação das automações de marketing.');}finally{this.running=false;}
 }
}
