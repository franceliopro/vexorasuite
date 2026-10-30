import {materializePresetBundle} from './preset-bundle';
import {inheritedPresets,PresetAssignment} from './preset-inheritance';
import {isUUID} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {validDraft} from '../ai/chatbot-draft.controller';
import {mutateTenantSetting} from '../prisma/tenant-settings';
import {BadRequestException,Body,Controller,Delete,ForbiddenException,Get,Post,Param,Req,UseGuards} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PrismaService} from '../prisma/prisma.service';
import {DEPARTMENT_PRESETS,SEGMENTS,segmentAgentPrompt,templateFlow} from './business-templates';
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
 @Delete(':id') async remove(@Req() req:AuthenticatedRequest,@Param('id') id:string){
 this.admin(req);if(!isUUID(id))throw new BadRequestException('Fluxo inválido.');
 await mutateTenantSetting(this.prisma,req.user.tenantId,'businessFlows',current=>{const flows={...((current||{}) as Prisma.JsonObject)};if(!Object.hasOwn(flows,id))throw new BadRequestException('Fluxo não encontrado.');delete flows[id];return flows as Prisma.InputJsonValue;});
 return {removed:true,id};
 }
 @Post('apply') async apply(@Req() req:AuthenticatedRequest,@Body() body:any){
 this.admin(req);
 const segment=SEGMENTS.find(s=>s.id===body?.segmentId),category=body?.department as keyof typeof DEPARTMENT_PRESETS|undefined;
 if(!segment||(category!==undefined&&!Object.hasOwn(DEPARTMENT_PRESETS,category))||(body.activateWorkflow!==undefined&&typeof body.activateWorkflow!=='boolean'))throw new BadRequestException('Selecione um segmento e um padrão válidos.');
 if(body.userId!==undefined&&(!category||!isUUID(body.userId)))throw new BadRequestException('Selecione o atendente e o padrão.');
 if(category&&body.userId===undefined&&!isUUID(body.departmentId||''))throw new BadRequestException('Selecione o departamento que receberá o padrão.');
 return this.prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
  const tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
  const root=(tenant.integrations||{}) as Record<string,any>,presets={...(root.businessPresets||{})},flows={...(root.businessFlows||{})};
  const targets:any[]=[];
  if(body.userId){
   const member=await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:body.userId,user:{isActive:true}},include:{user:{select:{name:true}}}});
   if(!member)throw new BadRequestException('Atendente não encontrado nesta empresa.');
   await tx.membership.update({where:{id:member.id},data:{modules:[...new Set([...member.modules,...DEPARTMENT_PRESETS[category!].modules])]}});
   targets.push({category:category!,name:member.user.name,userId:body.userId,departmentId:null,key:null,pipelineId:null});
  }else for(const key of category?[category]:['SUPPORT','FINANCE','SALES','GENERAL'] as const){
   const spec=DEPARTMENT_PRESETS[key];
   let row=await tx.department.findFirst({where:category?{id:body.departmentId,tenantId:req.user.tenantId,isActive:true}:{tenantId:req.user.tenantId,key}});
   if(category&&!row)throw new BadRequestException('Departamento não encontrado nesta empresa.');
   if(!row)row=await tx.department.create({data:{tenantId:req.user.tenantId,key,name:spec.name,modules:spec.modules,routingCategory:spec.category,isActive:true}});
   else if(category)row=await tx.department.update({where:{id:row.id},data:{modules:[...new Set([...row.modules,...spec.modules])],routingCategory:spec.category}});
   let pipeline=await tx.crmPipeline.findUnique({where:{departmentId:row.id}});
   if(!pipeline&&row.modules.includes('CRM'))pipeline=await tx.crmPipeline.create({data:{tenantId:req.user.tenantId,departmentId:row.id,name:'CRM · '+row.name,template:key,stages:pipelineStages(key),enabled:row.isActive}});
   targets.push({category:key,name:row.name,userId:null,departmentId:row.id,key:row.key,pipelineId:pipeline?.id||null});
  }
  let changed=false;
  for(const target of targets){
   const id=target.userId?'user:'+target.userId+':'+target.category:'department:'+target.departmentId+':'+target.category;
   const old=presets[id]||{};
   if(old.bundleVersion===2&&body.activateWorkflow===undefined)continue;
   const spec=DEPARTMENT_PRESETS[target.category as keyof typeof DEPARTMENT_PRESETS];
   const assignment={name:target.name,departmentId:target.departmentId,departmentKey:target.key,userId:target.userId,preset:target.category,modules:spec.modules,pipelineId:target.pipelineId,segment:segment.name,agentInstructions:segmentAgentPrompt(segment.id, target.category as keyof typeof DEPARTMENT_PRESETS)};
   presets[id]=await materializePresetBundle(tx,{tenantId:req.user.tenantId,actorId:req.user.sub},root,id,assignment,old,body.activateWorkflow);
   if(!flows[id]){
    if(Object.keys(flows).length>=100)throw new BadRequestException('Limite de 100 fluxos atingido.');
    const draft=templateFlow(segment.id,target.category);draft.name='Fluxo '+target.name;
    for(const step of draft.steps)if(step.action==='human.handoff')step.config=JSON.stringify(target.userId?{targetMode:'PERSON',userId:target.userId}:{targetMode:'DEPARTMENT',departmentKey:target.key});
    flows[id]={draft,version:1};
   }
   changed=true;
  }
  if(!changed)return {installed:true,unchanged:true};
  if(!category&&!body.userId&&!flows[segment.id])flows[segment.id]={draft:templateFlow(segment.id),version:1};
  await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...root,businessPresets:presets,businessFlows:flows} as Prisma.InputJsonValue}});
  await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'business.template.applied',entityType:'tenant',entityId:req.user.tenantId,details:{segmentId:segment.id,bundleVersion:2}}});
  return {installed:true,unchanged:false,draftOnly:true};
 });
 }
}
