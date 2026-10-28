import {BadGatewayException,BadRequestException,ConflictException,ForbiddenException,Injectable} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {isUUID} from 'class-validator';
import {PrismaService} from '../prisma/prisma.service';
import {AuthenticatedRequest} from '../auth/auth.types';
import {GoogleAccessService} from './google-access.service';
import {driveId} from '../ai/drive-manager.service';
const object=(v:any):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const FOLDER='application/vnd.google-apps.folder';
const names=['Referências','Novidades','Prontas','Publicadas'];
export function resourceKey(departmentId?:string|null,userId?:string|null){return userId?'user:'+userId+(departmentId?':department:'+departmentId:''):departmentId?'department:'+departmentId:'company';}
export function effectiveResources(root:any,departmentId?:string|null,userId?:string|null){
 const all=object(object(root).departmentResources),keys=['company',...(departmentId?['department:'+departmentId]:[]),...(userId?[resourceKey(departmentId,userId)]:[])];
 const result:Record<string,any>={};
 for(const key of keys)for(const resource of ['drive','calendar'])if(object(all[key])[resource])result[resource]={...all[key][resource],source:key};
 return result;
}
@Injectable()
export class DepartmentResourcesService{
 constructor(private readonly prisma:PrismaService,private readonly google:GoogleAccessService){}
 private admin(req:AuthenticatedRequest){if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException('Somente administradores configuram os recursos.');}
 private async target(db:any,req:AuthenticatedRequest,input:any){
  const departmentId=input.departmentId||null,userId=input.userId||null;
  if((departmentId&&!isUUID(departmentId))||(userId&&!isUUID(userId)))throw new BadRequestException('Destino inválido.');
  const department=departmentId?await db.department.findFirst({where:{id:departmentId,tenantId:req.user.tenantId,isActive:true}}):null;
  if(departmentId&&!department)throw new BadRequestException('Departamento não encontrado nesta empresa.');
  const member=userId?await db.membership.findFirst({where:{tenantId:req.user.tenantId,userId,user:{isActive:true}},include:{user:{select:{name:true}}}}):null;
  if(userId&&!member)throw new BadRequestException('Atendente não encontrado nesta empresa.');
  if(departmentId&&userId&&!await db.departmentMember.findFirst({where:{tenantId:req.user.tenantId,departmentId,userId},select:{id:true}}))throw new BadRequestException('Atendente não pertence ao departamento.');
  return {departmentId,userId,key:resourceKey(departmentId,userId),label:member?.user.name||department?.name||'Empresa'};
 }
 async list(req:AuthenticatedRequest){this.admin(req);const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});return {resources:object(object(tenant.integrations).departmentResources),jobs:Object.entries(object(object(tenant.integrations).departmentResourceJobs)).map(([key,job])=>({key,state:job.state,updatedAt:job.updatedAt}))};}
 async context(req:AuthenticatedRequest,input:any){
  const target=await this.target(this.prisma,req,input);
  if(!['OWNER','ADMIN'].includes(req.user.role)){
   if(target.userId&&target.userId!==req.user.sub)throw new ForbiddenException();
   if(target.departmentId&&!await this.prisma.departmentMember.findFirst({where:{tenantId:req.user.tenantId,departmentId:target.departmentId,userId:req.user.sub},select:{id:true}}))throw new ForbiddenException();
   if(!target.departmentId&&target.userId!==req.user.sub)throw new ForbiddenException();
  }
  const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
  return effectiveResources(tenant.integrations,target.departmentId,target.userId);
 }
 private async request(token:string,path:string,init:RequestInit={},missing=false){
  const response=await fetch('https://www.googleapis.com/'+path,{...init,headers:{authorization:'Bearer '+token,'content-type':'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
  if(missing&&response.status===404)return null;
  if(!response.ok)throw new BadGatewayException('O Google não confirmou a operação. Você pode retomar a configuração sem criar novas pastas.');
  return response.json() as Promise<any>;
 }
 async configure(req:AuthenticatedRequest,input:any){
  this.admin(req);
  await this.target(this.prisma,req,input);
  if(!input.driveAccountId&&!input.calendarAccountId)throw new BadRequestException('Selecione ao menos uma conexão Google.');
  for(const field of ['driveAccountId','calendarAccountId'])if(input[field]&&!isUUID(input[field]))throw new BadRequestException('Conta Google inválida.');
  const parent=driveId(input.parentFolderId||'root',true);
  const driveToken=input.driveAccountId?await this.google.token(req.user.tenantId,input.driveAccountId,'drive'):null;
  let calendar:any=null;
  if(input.calendarAccountId){
   if(typeof input.calendarId!=='string'||!input.calendarId.trim()||input.calendarId.length>300)throw new BadRequestException('Selecione a agenda.');
   const token=await this.google.token(req.user.tenantId,input.calendarAccountId,'calendar');
   const data=await this.request(token,'calendar/v3/users/me/calendarList/'+encodeURIComponent(input.calendarId));
   if(!['owner','writer'].includes(data.accessRole))throw new BadRequestException('Selecione uma agenda com permissão de edição.');
   calendar={accountId:input.calendarAccountId,calendarId:data.id,name:data.summary||data.id};
  }
  const job=await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
   const target=await this.target(tx,req,input),tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
   const root=object(tenant.integrations),jobs=object(root.departmentResourceJobs),old=object(jobs[target.key]);
   const signature=JSON.stringify({driveAccountId:input.driveAccountId||null,parent,calendar});
   if(old.signature===signature)return old;
   let ids:string[]=[];
   if(driveToken){const generated=await this.request(driveToken,'drive/v3/files/generateIds?count=5&space=drive&type=files');ids=generated.ids;if(!Array.isArray(ids)||ids.length!==5||ids.some(id=>typeof id!=='string'))throw new BadGatewayException('Google não gerou os identificadores das pastas.');}
   const job={id:randomUUID(),signature,...target,accountId:input.driveAccountId||null,parent,calendar,ids,state:'PENDING',updatedAt:new Date().toISOString()};
   await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...root,departmentResourceJobs:{...jobs,[target.key]:job}} as Prisma.InputJsonValue}});
   return job;
  },{timeout:20000});
  let drive:any=null;
  if(driveToken){
   const parentFile=await this.request(driveToken,'drive/v3/files/'+encodeURIComponent(job.parent)+'?fields=id,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true');
   if(parentFile.mimeType!==FOLDER||parentFile.trashed||parentFile.capabilities?.canAddChildren===false)throw new BadRequestException('A pasta de destino não permite criar pastas.');
   const labels=['Véxora · '+job.label,...names];
   for(let index=0;index<job.ids.length;index++){
    const id=job.ids[index],folderParent=index?job.ids[0]:parentFile.id;
    let file=await this.request(driveToken,'drive/v3/files/'+encodeURIComponent(id)+'?fields=id,mimeType,parents,trashed&supportsAllDrives=true',{},true);
    if(!file){
     const created=await fetch('https://www.googleapis.com/drive/v3/files?fields=id,mimeType,parents,trashed&supportsAllDrives=true',{method:'POST',headers:{authorization:'Bearer '+driveToken,'content-type':'application/json'},body:JSON.stringify({id,name:labels[index],mimeType:FOLDER,parents:[folderParent]}),signal:AbortSignal.timeout(12000),redirect:'error'});
     if(created.status===409)file=await this.request(driveToken,'drive/v3/files/'+encodeURIComponent(id)+'?fields=id,mimeType,parents,trashed&supportsAllDrives=true');
     else if(!created.ok)throw new BadGatewayException('Não foi possível confirmar a criação. Retome para verificar os mesmos identificadores.');
     else file=await created.json();
    }
    if(file.mimeType!==FOLDER||file.trashed||!file.parents?.includes(folderParent))throw new ConflictException('Uma pasta provisionada foi movida ou removida. Revise o destino antes de continuar.');
   }
   drive={accountId:job.accountId,parentFolderId:job.parent,folderId:job.ids[0],folders:Object.fromEntries(names.map((name,index)=>[name,job.ids[index+1]]))};
  }
  return this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
   await this.target(tx,req,input);
   const tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}}),root=object(tenant.integrations),jobs=object(root.departmentResourceJobs),resources=object(root.departmentResources);
   if(object(jobs[job.key]).id!==job.id)throw new ConflictException('Há uma configuração mais recente. Atualize a tela.');
   if(job.calendar){
    const where={tenantId:req.user.tenantId,accountId:job.calendar.accountId,calendarId:job.calendar.calendarId,userId:job.userId,departmentId:job.departmentId};
    if((job.userId||job.departmentId)&&!await tx.calendarAssignment.findFirst({where}))await tx.calendarAssignment.create({data:where});
   }
   const configured={...object(resources[job.key]),...(drive?{drive}:{}),...(job.calendar?{calendar:job.calendar}:{}),departmentId:job.departmentId,userId:job.userId,label:job.label};
   await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...root,departmentResources:{...resources,[job.key]:configured},departmentResourceJobs:{...jobs,[job.key]:{...job,state:'COMPLETED',updatedAt:new Date().toISOString()}}} as Prisma.InputJsonValue}});
   await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'department.resources.configured',entityType:'resource_binding',entityId:job.key,details:{drive:!!drive,calendar:!!job.calendar}}});
   return configured;
  });
 }
}
