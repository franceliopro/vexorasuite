import {BadRequestException,Body,Controller,Get,Patch,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';
import {Prisma} from '@prisma/client';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {assertDraftInput} from '../auth/product-scope';
import {MarketingLibraryService} from './marketing-library.service';
import {AssistantAutomationService} from './assistant-automation.service';
import {ZernioService} from '../operations/zernio.service';
@Controller('marketing')
@UseGuards(AuthGuard)
export class MarketingController{
 constructor(private readonly library:MarketingLibraryService,private readonly automation:AssistantAutomationService,private readonly prisma:PrismaService,private readonly zernio:ZernioService){}
 @Get('library') config(@Req() req:AuthenticatedRequest){return this.library.config(req);}
 @Get('automation') getAutomation(@Req() req:AuthenticatedRequest){return this.library.automation(req);}
 @Patch('automation') saveAutomation(@Req() req:AuthenticatedRequest,@Body() input:any){return this.library.saveAutomation(req,input);}
 @Post('library') save(@Req() req:AuthenticatedRequest,@Body() input:any){
  if(input?.autoPublish===true)throw new BadRequestException('A publicação automática foi retirada.');
  return this.library.save(req,{...input,autoPublish:false});
 }
 @Post('library/sync') async sync(@Req() req:AuthenticatedRequest){await this.library.sync(req,true);return {answer:'Referências sincronizadas.'};}
 @Patch('drafts/:id/review') async review(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){
  if(typeof input?.caption!=='string'||!input.caption.trim()||input.caption.length>2000||typeof input.approved!=='boolean'||typeof input.plannedFor!=='string'||input.plannedFor!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.plannedFor)||!Number.isFinite(Date.parse(input.plannedFor))||new Date(input.plannedFor).toISOString().slice(0,10)!==input.plannedFor))throw new BadRequestException('Revisão inválida.');
  const record=await this.automation.read(req,id);const details=record.details as Prisma.JsonObject;
  if(!['DRAFT','MANUAL_READY'].includes(String(details.status)))throw new BadRequestException('Este conteúdo faz parte do histórico e não pode ser alterado.');
  const updated=await this.prisma.auditLog.updateMany({where:{id:record.id,tenantId:req.user.tenantId,details:{equals:record.details!}},data:{details:{...details,status:input.approved?'MANUAL_READY':'DRAFT',carousel:{...(details.carousel as Prisma.JsonObject),caption:input.caption.trim()},manualReview:{approved:input.approved,plannedFor:input.plannedFor,reviewedBy:req.user.sub,reviewedAt:new Date().toISOString()}}}});
  if(!updated.count)throw new BadRequestException('O conteúdo mudou em outra janela. Reabra para revisar.');
  return {saved:true};
 }
 @Post('drafts') draft(@Req() req:AuthenticatedRequest,@Body() input:any){
  this.automation.authorize(req);assertDraftInput(input);
  return this.automation.createCarousel(req,input.question,{format:input.format,draftOnly:true,useBrandOnly:input.useBrandOnly!==false});
 }
 @Get('manual-drafts') async manualList(@Req() req:AuthenticatedRequest){
  this.automation.authorize(req);
  const rows=await this.prisma.auditLog.findMany({where:{tenantId:req.user.tenantId,action:'marketing.manual-draft'},orderBy:{createdAt:'desc'},take:100});
  return rows.map(row=>({id:row.id,createdAt:row.createdAt,details:row.details}));
 }
 @Post('manual-drafts') async manualCreate(@Req() req:AuthenticatedRequest,@Body() input:any){
  this.automation.authorize(req);
  const title=typeof input?.title==='string'?input.title.trim():'';
  const caption=typeof input?.caption==='string'?input.caption.trim():'';
  const channels=Array.isArray(input?.channels)?input.channels.filter((v:any)=>typeof v==='string'&&v.length<=40).slice(0,12):[];
  const plannedFor=typeof input?.plannedFor==='string'?input.plannedFor:'';
  const mediaSource=input?.mediaSource==='google-drive'?'google-drive':'';
  const mediaFileId=typeof input?.mediaFileId==='string'?input.mediaFileId.trim().slice(0,200):'';
  const mediaAccountId=typeof input?.mediaAccountId==='string'?input.mediaAccountId.trim().slice(0,80):'';
  const mediaName=typeof input?.mediaName==='string'?input.mediaName.trim().slice(0,180):'';
  const rawMediaItems=Array.isArray(input?.mediaItems)?input.mediaItems.slice(0,10):[];
  const mediaItems=rawMediaItems.filter((item:any)=>item&&typeof item==='object').map((item:any)=>({mediaSource:item.mediaSource==='google-drive'?'google-drive':'',mediaFileId:typeof item.mediaFileId==='string'?item.mediaFileId.trim().slice(0,200):'',mediaAccountId:typeof item.mediaAccountId==='string'?item.mediaAccountId.trim().slice(0,80):'',mediaName:typeof item.mediaName==='string'?item.mediaName.trim().slice(0,180):'',thumbnailUrl:typeof item.thumbnailUrl==='string'?item.thumbnailUrl.slice(0,1000):'',mediaUrl:typeof item.mediaUrl==='string'?item.mediaUrl.slice(0,1000):''})).filter((item:any)=>item.mediaUrl||item.mediaFileId);
  if(mediaItems.some((item:any)=>item.mediaSource==='google-drive'&&(!item.mediaFileId||!item.mediaAccountId)))throw new BadRequestException('Um dos arquivos do Google Drive é inválido.');
  if(!title||title.length>180||!caption||caption.length>4000||!channels.length||plannedFor&&(!/^\d{4}-\d{2}-\d{2}$/.test(plannedFor)||!Number.isFinite(Date.parse(plannedFor)))||mediaSource==='google-drive'&&(!mediaFileId||!mediaAccountId))throw new BadRequestException('Preencha título, legenda, redes e data válida.');
  const id=randomUUID();
  await this.prisma.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'marketing.manual-draft',entityType:'publication',entityId:id,details:{status:'DRAFT',title,caption,channels,mediaUrl:typeof input.mediaUrl==='string'?input.mediaUrl.slice(0,1000):'',mediaSource,mediaFileId,mediaAccountId,mediaName,thumbnailUrl:typeof input?.thumbnailUrl==='string'?input.thumbnailUrl.slice(0,1000):'',mediaItems,plannedFor}}});
  return {id,status:'DRAFT'};
 }
 @Post('manual-drafts/:id/publish') async publishNow(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){return this.publishDraft(req,id,{publishNow:true});}
 @Post('manual-drafts/:id/schedule') async schedule(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){const plannedFor=typeof input?.plannedFor==='string'?input.plannedFor:'';if(!/^\d{4}-\d{2}-\d{2}$/.test(plannedFor)||!Number.isFinite(Date.parse(plannedFor)))throw new BadRequestException('Informe uma data válida para agendar.');return this.publishDraft(req,id,{publishNow:false,scheduledFor:plannedFor+'T12:00:00-03:00'});}
 private async publishDraft(req:AuthenticatedRequest,id:string,options:{publishNow:boolean;scheduledFor?:string}){
  this.automation.authorize(req);
  const row=await this.prisma.auditLog.findFirst({where:{id,tenantId:req.user.tenantId,action:'marketing.manual-draft'}});
  if(!row)throw new BadRequestException('Rascunho não encontrado.');
  const details=(row.details&&typeof row.details==='object'&&!Array.isArray(row.details)?row.details:{}) as any;
  if(['PUBLISHED','SCHEDULED'].includes(String(details.status)))throw new BadRequestException('Esta publicação já foi enviada.');
  const channelIds=Array.isArray(details.channels)?details.channels.filter((v:any)=>typeof v==='string').slice(0,12):[];
  if(!channelIds.length)throw new BadRequestException('Escolha ao menos uma conta de publicação.');
  const channels=await this.prisma.channelConnection.findMany({where:{tenantId:req.user.tenantId,id:{in:channelIds},isActive:true},select:{id:true,provider:true,status:true,settings:true}});
  const platforms=channels.map(channel=>{const settings=channel.settings&&typeof channel.settings==='object'&&!Array.isArray(channel.settings)?channel.settings as Record<string,unknown>:{};return {platform:typeof settings.platform==='string'?settings.platform:'',accountId:typeof settings.accountId==='string'?settings.accountId:''};}).filter(item=>item.platform&&item.accountId);
  if(!platforms.length)throw new BadRequestException('As contas escolhidas ainda não estão prontas para publicar. Reconecte uma conta social.');
  if(platforms.length!==channelIds.length)throw new BadRequestException('Uma das contas escolhidas não é uma conta social Zernio válida.');
  const mediaItems=Array.isArray(details.mediaItems)?details.mediaItems.filter((item:any)=>item&&typeof item.mediaUrl==='string'&&/^https?:\/\//.test(item.mediaUrl)).slice(0,10).map((item:any)=>({type:item.mediaName?.toLowerCase().endsWith('.mp4')?'video':'image',url:item.mediaUrl})):undefined;
  const payload:any={content:String(details.caption||''),platforms,...(mediaItems?.length?{mediaItems}:{}),...(options.publishNow?{publishNow:true}:{scheduledFor:options.scheduledFor,timezone:'America/Sao_Paulo'})};
  const response=await this.zernio.request<any>('/posts',{method:'POST',body:payload,idempotencyKey:'marketing-'+id+'-'+(options.publishNow?'now':options.scheduledFor||'schedule')});
  const nextStatus=options.publishNow?'PUBLISHED':'SCHEDULED';
  await this.prisma.auditLog.update({where:{id:row.id},data:{details:{...details,status:nextStatus,publication:{requestedAt:new Date().toISOString(),publishNow:options.publishNow,scheduledFor:options.scheduledFor||null,response:response?.post||response}}}});
  return {id,status:nextStatus,post:response?.post||response};
 }
 @Patch('manual-drafts/:id') async manualUpdate(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){
  this.automation.authorize(req);
  const row=await this.prisma.auditLog.findFirst({where:{id,tenantId:req.user.tenantId,action:'marketing.manual-draft'}});
  if(!row)throw new BadRequestException('Rascunho não encontrado.');
  const current=(row.details&&typeof row.details==='object'&&!Array.isArray(row.details)?row.details:{}) as any;
  const next={...current,...(typeof input?.caption==='string'?{caption:input.caption.trim()}:{}),...(typeof input?.plannedFor==='string'?{plannedFor:input.plannedFor}:{}),...(typeof input?.status==='string'&&['DRAFT','READY'].includes(input.status)?{status:input.status}: {})};
  await this.prisma.auditLog.update({where:{id},data:{details:next}});
  return {id,status:next.status};
 }
}
