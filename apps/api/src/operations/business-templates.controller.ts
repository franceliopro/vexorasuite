import {inheritedPresets,PresetAssignment} from './preset-inheritance';
import {isUUID} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {validDraft} from '../ai/chatbot-draft.controller';
import {mutateTenantSetting} from '../prisma/tenant-settings';
import {BadRequestException,Body,Controller,ForbiddenException,Get,Post,Param,Req,UseGuards} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PrismaService} from '../prisma/prisma.service';
import {DEPARTMENT_PRESETS,SEGMENTS,templateFlow} from './business-templates';
import {pipelineStages} from './departments.controller';
@Controller('business-templates') @UseGuards(AuthGuard)
export class BusinessTemplatesController {
 constructor(private readonly prisma:PrismaService){}
 private admin(req:AuthenticatedRequest){if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException('Somente administradores configuram padrões.');}
 @Get() async list(@Req() req:AuthenticatedRequest){
 this.admin(req);
 const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
 const root=(tenant.integrations||{}) as Prisma.JsonObject;
 return {segments:SEGMENTS,departments:DEPARTMENT_PRESETS,installed:root.businessPresets||{},flows:root.businessFlows||{},folders:['Referências','Novidades','Prontas']};
 }
 @Get('effective/:userId') async effective(@Req() req:AuthenticatedRequest,@Param('userId') userId:string){
 this.admin(req);if(!isUUID(userId))throw new BadRequestException('Atendente inválido.');
 const member=await this.prisma.membership.findFirst({where:{tenantId:req.user.tenantId,userId,user:{isActive:true}},select:{id:true}});
 if(!member)throw new BadRequestException('Atendente não encontrado nesta empresa.');
 const [links,tenant]=await Promise.all([
 this.prisma.departmentMember.findMany({where:{tenantId:req.user.tenantId,userId,department:{isActive:true}},select:{departmentId:true}}),
 this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}})
 ]);
 const root=(tenant.integrations||{}) as Prisma.JsonObject;
 return {presets:inheritedPresets((root.businessPresets||{}) as Record<string,PresetAssignment>,userId,links.map(d=>d.departmentId))};
 }
 @Post('save-flow') async saveFlow(@Req() req:AuthenticatedRequest,@Body() body:any){
 this.admin(req);if(!validDraft(body?.draft))throw new BadRequestException('Fluxo inválido.');
 const id=randomUUID();
 await mutateTenantSetting(this.prisma,req.user.tenantId,'businessFlows',current=>{
 const flows=(current||{}) as Prisma.JsonObject;
 if(Object.keys(flows).length>=100)throw new BadRequestException('Limite de 100 fluxos atingido.');
 return {...flows,[id]:{draft:body.draft,version:1}} as Prisma.InputJsonValue;
 });
 return {saved:true,id};
 }
 @Post('apply') async apply(@Req() req:AuthenticatedRequest,@Body() body:any){
 this.admin(req);
 const segment=SEGMENTS.find(s=>s.id===body?.segmentId);
 const department=body?.department as keyof typeof DEPARTMENT_PRESETS|undefined;
 if(!segment || (department!==undefined&&!Object.hasOwn(DEPARTMENT_PRESETS,department)))throw new BadRequestException('Selecione um segmento e um padrão válidos.');
 return this.prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
 const tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
 const root=(tenant.integrations||{}) as Prisma.JsonObject;
 const installed=(root.businessPresets||{}) as Prisma.JsonObject;
 if(body.userId!==undefined){ if(!department||!isUUID(body.userId))throw new BadRequestException('Selecione o atendente e o padrão.');
 const member=await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:body.userId,user:{isActive:true}},include:{user:{select:{name:true}}}});
 if(!member)throw new BadRequestException('Atendente não encontrado nesta empresa.');
 const id='user:'+body.userId+':'+department;
 if(installed[id])return {installed:true,unchanged:true};
 const preset=DEPARTMENT_PRESETS[department];
 const draft=templateFlow(segment.id,department);draft.name='Fluxo '+member.user.name+' · '+preset.name;
 for(const step of draft.steps)if(step.action==='human.handoff')step.config=JSON.stringify({targetMode:'PERSON',userId:body.userId});
 const flows=(root.businessFlows||{}) as Prisma.JsonObject;
 if(Object.keys(flows).length>=100)throw new BadRequestException('Limite de 100 fluxos atingido.');
 await tx.membership.update({where:{id:member.id},data:{modules:[...new Set([...member.modules,...preset.modules])]}});
 await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...root,businessFlows:{...flows,[id]:{draft,version:1}},businessPresets:{...installed,[id]:{version:1,userId:body.userId,departmentId:null,preset:department,modules:preset.modules,segment:segment.name,agentInstructions:segment.guidance}}} as unknown as Prisma.InputJsonValue}});
 await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'business.template.applied',entityType:'user',entityId:body.userId,details:{templateId:id,version:1}}});
 return {installed:true,draftOnly:true};
 }
 if(department&&(!isUUID(body.departmentId||'')))throw new BadRequestException('Selecione o departamento que receberá o padrão.');
const target=department?await tx.department.findFirst({where:{id:body.departmentId,tenantId:req.user.tenantId,isActive:true}}):null;
if(department&&!target)throw new BadRequestException('Departamento não encontrado nesta empresa.');
const id=department?'department:'+target!.id+':'+department:segment.id;
 if(installed[id])return {installed:true,unchanged:true};
 const keys=department?[department]:['SUPPORT','FINANCE','SALES','GENERAL'] as const;
 const destinations:Record<string,string>={};
for(const key of keys){
 const preset=DEPARTMENT_PRESETS[key];
 let row=target||await tx.department.findFirst({where:{tenantId:req.user.tenantId,key}});
 if(!row)row=await tx.department.create({data:{tenantId:req.user.tenantId,key,name:preset.name,modules:preset.modules,routingCategory:preset.category,isActive:true}});
  if(target)row=await tx.department.update({where:{id:target.id},data:{modules:[...new Set([...target.modules,...preset.modules])],routingCategory:preset.category}});
 destinations[key]=row.key;
 const existing=await tx.crmPipeline.findUnique({where:{departmentId:row.id}});
 if(!existing&&row.modules.includes('CRM'))await tx.crmPipeline.create({data:{tenantId:req.user.tenantId,departmentId:row.id,name:'CRM · '+row.name,template:key,stages:pipelineStages(key),enabled:row.isActive}});
 }
 const flows=(root.businessFlows||{}) as Prisma.JsonObject;
 const flow=templateFlow(segment.id,department);
if(target)flow.name='Fluxo '+target.name;
for(const step of flow.steps){if(!step.config)continue;const config=JSON.parse(step.config);if(config.departmentKey)config.departmentKey=destinations[config.departmentKey]||config.departmentKey;step.config=JSON.stringify(config);}
 await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...root,businessFlows:{...flows,[id]:{draft:flow,version:1}},businessPresets:{...installed,[id]:{version:1,departmentId:target?.id||null,departmentKey:target?.key||null,preset:department||null,modules:department?DEPARTMENT_PRESETS[department].modules:[],segment:segment.name,folders:['Referências','Novidades','Prontas'],googleStatus:'PENDING_CONNECTION',agentInstructions:'Atenda em nome da empresa, com linguagem natural. '+segment.guidance}}} as unknown as Prisma.InputJsonValue}});
 await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'business.template.applied',entityType:'tenant',entityId:req.user.tenantId,details:{templateId:id,version:1}}});
 return {installed:true,unchanged:false,draftOnly:true};
 });
 }
}




