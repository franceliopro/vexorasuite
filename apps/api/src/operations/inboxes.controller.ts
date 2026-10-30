import {BadRequestException,Body,Controller,ForbiddenException,Get,Param,ParseUUIDPipe,Post,Req,UseGuards} from "@nestjs/common";
import {settings as stepSettings} from "../ai/flow-runtime";
import {randomUUID} from "node:crypto";
import {isUUID} from "class-validator";
import {AuthGuard} from "../auth/auth.guard";
import {AuthenticatedRequest} from "../auth/auth.types";
import {PrismaService} from "../prisma/prisma.service";
import {inboxRouting} from "./inbox-routing";
import {selectPublication,publicationKey} from "./runtime-scope";
const object=(v:unknown):Record<string,any>=>v&&typeof v==="object"&&!Array.isArray(v)?v as any:{};
@Controller("channels") @UseGuards(AuthGuard)
export class InboxesController{
 constructor(private readonly prisma:PrismaService){}
 private authorize(req:AuthenticatedRequest){if(!["OWNER","ADMIN"].includes(req.user.role))throw new ForbiddenException("Somente administradores podem gerenciar as inbox.");}
 @Get("inboxes")
 async list(@Req() req:AuthenticatedRequest){
  this.authorize(req);const tenantId=req.user.tenantId;
  const [tenant,channels,departments]=await Promise.all([
   this.prisma.tenant.findUniqueOrThrow({where:{id:tenantId},select:{integrations:true,kind:true}}),
   this.prisma.channelConnection.findMany({where:{tenantId,isActive:true,provider:{in:["WAHA","ZERNIO"]}},orderBy:{createdAt:"asc"}}),
   this.prisma.department.findMany({where:{tenantId,isActive:true},select:{id:true,name:true},orderBy:{name:"asc"}})
  ]);
  const root=object(tenant.integrations),assistant=object(root.assistant);
  const visibleChannels=tenant.kind==="PLATFORM"?channels.filter(channel=>channel.provider!=="ZERNIO"):channels;
  const rows=await Promise.all(visibleChannels.map(async channel=>{
   const config=object(channel.settings),routing=inboxRouting(config),scope={departmentId:routing.departmentId};
   const selection=selectPublication(root,scope),publication=selection?.publication;
   const [inbound,outbound]=await Promise.all([
    this.prisma.message.findFirst({where:{tenantId,direction:"INBOUND",conversation:{channelConnectionId:channel.id,deletedAt:null}},orderBy:{occurredAt:"desc"},select:{id:true,occurredAt:true,conversation:{select:{id:true,handlingMode:true,departmentId:true,assigneeId:true,status:true}}}}),
    this.prisma.message.findFirst({where:{tenantId,direction:"OUTBOUND",conversation:{channelConnectionId:channel.id,deletedAt:null},metadata:{path:["engine"],equals:true}},orderBy:{createdAt:"desc"},select:{id:true,status:true,occurredAt:true}})
   ]);
   const audit=inbound?await this.prisma.auditLog.findFirst({where:{tenantId,entityId:inbound.id,action:"engine.processed"},orderBy:{createdAt:"desc"},select:{createdAt:true,details:true}}):null;
   const agentIds=[...new Set((publication?.flow?.steps||[]).filter(s=>s.kind==="agent").map(s=>String(stepSettings(s).agentId||"")).filter(Boolean))];
   const agents=agentIds.map(id=>{const agent=(Array.isArray(assistant.agents)?assistant.agents:[]).find((a:any)=>a.id===id);return {id,name:String(agent?.name||"Agente indisponível"),enabled:agent?.enabled===true};});
   const blockers:string[]=[];
   if(channel.status!=="CONNECTED")blockers.push("A conexão não está confirmada como conectada.");
   if(routing.departmentId&&!departments.some(d=>d.id===routing.departmentId))blockers.push("O departamento de entrada está indisponível.");
   if(routing.mode!=="HUMAN"){
    if(!publication)blockers.push("Não há fluxo publicado para a entrada desta inbox.");
    else{if(!publication.active)blockers.push("O fluxo desta entrada está pausado.");if(!publication.flow.channelIds?.includes(channel.id))blockers.push("O fluxo publicado não inclui esta conexão real.");if(!publication.flow.triggers?.some(t=>["message","dm","keyword"].includes(t.kind)))blockers.push("O fluxo não tem um gatilho de entrada compatível.");}
    if(agentIds.length&&assistant.enabled!==true)blockers.push("A IA está desabilitada nesta empresa.");
    if(agents.some(a=>!a.enabled))blockers.push("Um agente do fluxo está desabilitado ou indisponível.");
   }
   const last=inbound?.conversation;
   const activeSelection=last?selectPublication(root,{departmentId:last.departmentId,userId:last.assigneeId}):null;
   let lastDecision=!inbound?"Nenhuma mensagem recebida registrada.":last?.handlingMode==="HUMAN"?"Conversa sob atendimento humano; a IA não assume automaticamente.":audit?"Mensagem processada pelo motor.":!activeSelection?.publication?.flow.channelIds?.includes(channel.id)?"Mensagem recebida; não há fluxo vinculado ao contexto desta conversa.":!activeSelection.publication.active?"Mensagem recebida; o fluxo está pausado.":"Mensagem recebida; sem processamento confirmado. Verifique o gatilho e os registros da API.";
   return {id:channel.id,name:channel.name,provider:channel.provider,platform:channel.provider==="WAHA"?"whatsapp":String(config.platform||"social"),status:channel.status,identity:channel.provider==="WAHA"?config.accountPhone||null:config.username||config.profileName||null,identityCheckedAt:config.identityCheckedAt||null,accountId:channel.provider==="ZERNIO"?config.accountId||null:null,routing,departmentName:departments.find(d=>d.id===routing.departmentId)?.name||null,flow:publication?{name:publication.flow.name,active:publication.active,revision:publication.revision,scopeKey:selection?.key,includesInbox:publication.flow.channelIds?.includes(channel.id)===true,agents}:null,blockers,lastInboundAt:inbound?.occurredAt||null,lastConversationId:last?.id||null,lastDecision,lastProcessing:audit?{at:audit.createdAt,decision:object(audit.details).decision||null,reason:object(audit.details).reason||null}:null,lastDelivery:outbound?{at:outbound.occurredAt,status:outbound.status}:null};
  }));
  return {inboxes:rows,departments};
 }
 @Post(":id/inbox")
 async configure(@Req() req:AuthenticatedRequest,@Param("id",ParseUUIDPipe) id:string,@Body() body:{mode?:unknown;departmentId?:unknown;expectedRevision?:unknown}){
  this.authorize(req);
  if(!body||!["INHERIT","AUTOMATION","HUMAN"].includes(String(body.mode)))throw new BadRequestException("Escolha como esta inbox recebe novas conversas.");
  if(body.departmentId!=null&&(typeof body.departmentId!=="string"||!isUUID(body.departmentId)))throw new BadRequestException("Departamento inválido.");
  if(body.expectedRevision!==null&&typeof body.expectedRevision!=="string")throw new BadRequestException("Atualize a lista antes de salvar.");
  const tenantId=req.user.tenantId;
  return this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id=${tenantId}::uuid FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM channel_connections WHERE id=${id}::uuid AND tenant_id=${tenantId}::uuid FOR UPDATE`;
   const channel=await tx.channelConnection.findFirst({where:{id,tenantId,isActive:true,provider:{in:["WAHA","ZERNIO"]}}});
   if(!channel)throw new BadRequestException("Inbox indisponível nesta empresa.");
   const config=object(channel.settings),current=inboxRouting(config);
   if(current.revision!==body.expectedRevision)throw new BadRequestException("A inbox foi alterada por outra pessoa. Atualize e revise antes de salvar.");
   const departmentId=body.mode==="INHERIT"?null:typeof body.departmentId==="string"?body.departmentId:null;
   if(departmentId&&!await tx.department.findFirst({where:{id:departmentId,tenantId,isActive:true}}))throw new BadRequestException("Departamento indisponível nesta empresa.");
   if(body.mode==="AUTOMATION"){
    const tenant=await tx.tenant.findUniqueOrThrow({where:{id:tenantId},select:{integrations:true}});
    const root=object(tenant.integrations),key=publicationKey({departmentId}),selection=selectPublication(root,{departmentId});
    if(!selection||selection.key!==key||!selection.publication.active||!selection.publication.flow.channelIds?.includes(id))throw new BadRequestException("Publique e ative o fluxo deste destino incluindo esta inbox antes de vinculá-lo.");
   }
   const routing={mode:body.mode as "INHERIT"|"AUTOMATION"|"HUMAN",departmentId,revision:randomUUID()};
   await tx.channelConnection.update({where:{id},data:{settings:{...config,inboxRouting:routing}}});
   await tx.auditLog.create({data:{tenantId,userId:req.user.sub,action:"inbox.routing.updated",entityType:"channel",entityId:id,details:{mode:routing.mode,departmentId,revision:routing.revision}}});
   return routing;
  });
 }
}
