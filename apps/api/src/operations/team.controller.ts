import {attendantName,knownByValue} from "./attendant-name";
import { MODULES,moduleSelection,effectiveModules,patternModules } from "../auth/module-policy";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch, Delete, Param, ParseUUIDPipe,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { hash } from "bcryptjs";
import sharp from "sharp";
import { isUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
@Controller("team")
@UseGuards(AuthGuard)
export class TeamController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}
  private admin(req: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(req.user.role))
      throw new ForbiddenException(
        "Somente administradores podem cadastrar atendentes.",
      );
  }
  @Get() async list(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    const rows = await this.prisma.membership.findMany({
      where: { tenantId: req.user.tenantId },
      select: {
        knownBy: true,
        role: true,
        modules: true,
        deniedModules:true,
        user: { select: { id: true, name: true, email: true, avatarUrl:true, isActive: true,mustChangePassword:true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    const members = await this.prisma.departmentMember.findMany({
      where: { tenantId: req.user.tenantId },
      select: { departmentId: true, userId: true,department:{select:{modules:true,isActive:true}} },
    });
    const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
    return rows.map((r) => ({
      ...r.user,
      fullName:r.user.name,knownBy:r.knownBy,name:attendantName({name:r.user.name,knownBy:r.knownBy}),
      role: r.role,
      modules: effectiveModules(r.role,r.modules,members.filter(m=>m.userId===r.user.id).map(m=>m.department),patternModules(tenant.integrations,r.user.id,members.filter(m=>m.userId===r.user.id).map(m=>m.departmentId)),r.deniedModules),
      deniedModules:r.deniedModules,
      canEditAccess:req.user.isPlatformAdmin===true||r.role==="AGENT",
      departmentIds: members
        .filter((m) => m.userId === r.user.id)
        .map((m) => m.departmentId),
    }));
  }
  @Post() async create(@Req() req: AuthenticatedRequest, @Body() input: any) {
    this.admin(req);
    const knownBy=knownByValue(input.knownBy);
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password="Senha@123";
    const role=input.role==="OWNER"&&req.user.isPlatformAdmin?"OWNER":"AGENT";
    if(input.role&&input.role!==role)throw new ForbiddenException("Somente a administração da Véxora cadastra proprietários.");
    if (
      name.length < 2 ||
      name.length > 160 ||
      !/^[-\w.+]+@[\w.-]+\.[a-z]{2,}$/i.test(email) ||
      email.length > 254 ||
      password.length < 8 ||
      password.length > 128
    )
      throw new BadRequestException(
        "Informe nome e e-mail válidos. A senha inicial será Senha@123 e deverá ser trocada no primeiro acesso.",
      );
    const ids = Array.isArray(input.departmentIds)
      ? ([...new Set(input.departmentIds)] as string[])
      : [];
    if (
      ids.length > 50 ||
      ids.some((id) => typeof id !== "string" || !isUUID(id))
    )
      throw new BadRequestException("Selecione os setores válidos.");
    if (
      await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
    )
      throw new BadRequestException(
        "Este e-mail já possui uma conta. Use outro e-mail ou o vínculo existente da empresa.",
      );
    let modules: string[],deniedModules:string[];
    try {
      modules = moduleSelection(input.modules || []);
      deniedModules=moduleSelection(input.deniedModules||[]);
    } catch {
      throw new BadRequestException("Módulos inválidos.");
    }
    if(!req.user.isPlatformAdmin){const allowed=req.user.allowedModules||[];if(modules.some(m=>!allowed.includes(m)))throw new ForbiddenException("Você não pode conceder módulos que não possui.");deniedModules=[...new Set([...deniedModules,...MODULES.filter(m=>!allowed.includes(m))])];}
    const passwordHash = await hash(password, 12);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const departments = await tx.department.count({
          where: {
            id: { in: ids },
            tenantId: req.user.tenantId,
            isActive: true,
          },
        });
        if (departments !== ids.length)
          throw new BadRequestException(
            "Um setor não está ativo nesta empresa.",
          );
        const user = await tx.user.create({
          data: { name, email, passwordHash,mustChangePassword:true },
          select: { id: true, name: true, email: true },
        });
        await tx.membership.create({
          data: {
            tenantId: req.user.tenantId,
            userId: user.id,
            role,
            modules,deniedModules,knownBy,
          },
        });
        if (ids.length)
          await tx.departmentMember.createMany({
            data: ids.map((departmentId) => ({
              tenantId: req.user.tenantId,
              departmentId,
              userId: user.id,
            })),
          });
        await tx.auditLog.create({
          data: {
            tenantId: req.user.tenantId,
            userId: req.user.sub,
            action: "team.agent.created",
            entityType: "user",
            entityId: user.id,
            details: { departmentIds: ids },
          },
        });
        return user;
      });
      this.events.publish(req.user.tenantId, "team.updated", { id: user.id });
      return user;
    } catch (e) {
      if ((e as any).code === "P2002")
        throw new BadRequestException("Este e-mail já possui uma conta.");
      throw e;
    }
  }
 @Patch(':id/access') async access(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){this.admin(req);const knownBy=input.knownBy===undefined?undefined:knownByValue(input.knownBy);let modules:string[],deniedModules:string[];try{modules=moduleSelection(input.modules||[]);deniedModules=moduleSelection(input.deniedModules||[])}catch{throw new BadRequestException('Módulos inválidos.');}const ids=Array.isArray(input.departmentIds)?[...new Set(input.departmentIds)] as string[]:[];if(ids.length>50||ids.some(x=>!isUUID(x)))throw new BadRequestException('Setores inválidos.');await this.prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;const member=await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:id},include:{user:{select:{isPlatformAdmin:true}}}});if(member?.user.isPlatformAdmin&&!req.user.isPlatformAdmin)throw new ForbiddenException('O acesso da administração Véxora não pode ser alterado por uma empresa.');if(member&&!req.user.isPlatformAdmin){if(member.role!=='AGENT')throw new ForbiddenException('Somente a administração da Véxora altera acessos administrativos.');const allowed=req.user.allowedModules||[];if(modules.some(m=>!allowed.includes(m)))throw new ForbiddenException('Você não pode conceder módulos que não possui.');deniedModules=[...new Set([...member.deniedModules,...deniedModules,...MODULES.filter(m=>!allowed.includes(m))])];}if(!member||await tx.department.count({where:{tenantId:req.user.tenantId,id:{in:ids},isActive:true}})!==ids.length)throw new BadRequestException('Atendente ou setor não pertence à empresa.');await tx.membership.update({where:{id:member.id},data:{modules,deniedModules,...(knownBy===undefined?{}:{knownBy})}});await tx.departmentMember.deleteMany({where:{tenantId:req.user.tenantId,userId:id}});if(ids.length)await tx.departmentMember.createMany({data:ids.map(departmentId=>({tenantId:req.user.tenantId,departmentId,userId:id}))});await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'team.access.updated',entityType:'user',entityId:id,details:{modules,deniedModules,departmentIds:ids}}});});this.events.publish(req.user.tenantId,'team.updated',{id});return {updated:true};}

 @Patch(':id/profile') async profile(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){
  this.admin(req);
  const name=typeof input?.name==='string'?input.name.trim():'';
  const email=typeof input?.email==='string'?input.email.trim().toLowerCase():'';
  if(name.length<2||name.length>160||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))throw new BadRequestException('Informe nome e e-mail válidos.');
  await this.prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
    const member=await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:id},include:{user:{select:{isPlatformAdmin:true}}}});
    if(!member)throw new BadRequestException('Usuário não encontrado nesta empresa.');
    if(member.user.isPlatformAdmin&&!req.user.isPlatformAdmin)throw new ForbiddenException('Os dados da administração Véxora não podem ser alterados pela empresa.');
    const conflict=await tx.user.findFirst({where:{email,id:{not:id}},select:{id:true}});
    if(conflict)throw new BadRequestException('Este e-mail já pertence a outro usuário.');
    await tx.user.update({where:{id},data:{name,email}});
    await tx.membership.update({where:{id:member.id},data:{knownBy:typeof input.knownBy==='string'?input.knownBy.trim():member.knownBy}});
    await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'team.profile.updated',entityType:'user',entityId:id,details:{name,email}}});
  });
  this.events.publish(req.user.tenantId,'team.updated',{id});return {updated:true};
 }
 @Delete(':id') async remove(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){
  this.admin(req);
  if(id===req.user.sub)throw new BadRequestException('Você não pode desativar o próprio acesso.');
  await this.prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
    const member=await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:id},include:{user:{select:{isPlatformAdmin:true}}}});
    if(!member)throw new BadRequestException('Usuário não encontrado nesta empresa.');
    if(member.user.isPlatformAdmin&&!req.user.isPlatformAdmin)throw new ForbiddenException('A administração Véxora não pode ser desativada pela empresa.');
    await tx.user.update({where:{id},data:{isActive:false,authVersion:{increment:1}}});
    await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'team.user.deactivated',entityType:'user',entityId:id}});
  });
  this.events.publish(req.user.tenantId,'team.updated',{id});return {deactivated:true};
 }

 @Post(':id/photo')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:2*1024*1024,files:1,fields:0}}))
 async photo(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@UploadedFile() file?:{buffer:Buffer}){
  this.admin(req);
  if(!file?.buffer?.length)throw new BadRequestException('Envie uma imagem de até 2 MB.');
  const member=await this.prisma.membership.findFirst({where:{tenantId:req.user.tenantId,userId:id},include:{user:{select:{isPlatformAdmin:true}}}});
  if(!member)throw new BadRequestException('Usuário não encontrado nesta empresa.');
  if(member.user.isPlatformAdmin&&!req.user.isPlatformAdmin)throw new ForbiddenException('A foto da administração Véxora não pode ser alterada pela empresa.');
  let buffer:Buffer;
  try{buffer=await sharp(file.buffer,{limitInputPixels:16000000}).rotate().resize(160,160,{fit:'cover'}).webp({quality:85}).toBuffer();}
  catch{throw new BadRequestException('Imagem inválida.');}
  await this.prisma.user.update({where:{id},data:{avatarUrl:'data:image/webp;base64,'+buffer.toString('base64'),avatarSource:'UPLOAD',avatarCheckedAt:new Date()}});
  this.events.publish(req.user.tenantId,'team.updated',{id});
  return {updated:true};
 }
 @Patch(':id/identity') async identity(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:{knownBy?:unknown}){
  this.admin(req);const knownBy=knownByValue(input.knownBy);
  await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
   const member=await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:id},include:{user:{select:{isPlatformAdmin:true}}}});
   if(!member)throw new BadRequestException("Atendente não encontrado nesta empresa.");
   if(member.user.isPlatformAdmin&&!req.user.isPlatformAdmin)throw new ForbiddenException("A identidade da administração Véxora não pode ser alterada por outra empresa.");
   await tx.membership.update({where:{id:member.id},data:{knownBy}});
   await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:"team.identity.updated",entityType:"user",entityId:id,details:{knownBy}}});
  });this.events.publish(req.user.tenantId,"team.updated",{id});return {updated:true};
 }
 @Post(':id/reset-password') async resetPassword(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){
  if(!req.user.isPlatformAdmin&&!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException('Somente administradores podem redefinir senhas.');
  const passwordHash=await hash('Senha@123',12);
  await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
   if(!await tx.membership.findFirst({where:{tenantId:req.user.tenantId,userId:id},select:{id:true}}))throw new BadRequestException('Usuário não pertence a esta empresa.');
   await tx.user.update({where:{id},data:{passwordHash,mustChangePassword:true,authVersion:{increment:1}}});
   await tx.pushSubscription.deleteMany({where:{userId:id}});
   await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'user.password.reset',entityType:'user',entityId:id}});
  });
  this.events.publish(req.user.tenantId,'team.updated',{id});
  return {reset:true,mustChangePassword:true};
 }

}
