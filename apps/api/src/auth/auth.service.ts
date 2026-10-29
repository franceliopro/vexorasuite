import {BadRequestException,ForbiddenException} from '@nestjs/common';
import {isUUID} from 'class-validator';
import {SEGMENTS} from '../operations/business-templates';
import {provisionCompany} from './company-blueprint';
import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { MembershipRole } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private secret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
      throw new InternalServerErrorException("Autenticação indisponível: configure JWT_ACCESS_SECRET com pelo menos 32 bytes.");
    }
    return secret;
  }

  private async issueToken(payload: AuthPayload): Promise<string> {
    return this.jwt.signAsync(payload, { secret: this.secret(), expiresIn: "8h" });
  }

  async register(input: RegisterDto) {
    this.secret();
    const email = input.email.trim().toLowerCase();
    const passwordHash = await hash(input.password, 12);
    const baseSlug = input.tenantName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "empresa";
    const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(73910482)`;
        if(await tx.tenant.count()!==0)throw new ForbiddenException("O cadastro de empresas é feito pela administração da Véxora.");
        const tenant = await tx.tenant.create({
          data: { name: "Véxora Suite", slug, kind:"PLATFORM" },
        });
        const user = await tx.user.create({
          data: { name: input.name.trim(), email, passwordHash, isPlatformAdmin:true },
        });
        const membership = await tx.membership.create({
          data: { tenantId: tenant.id, userId: user.id, role: MembershipRole.OWNER },
        });
        return { tenant, user, membership };
      });

      const accessToken = await this.issueToken({
        sub: result.user.id,
        tenantId: result.tenant.id,
        tenantSlug: result.tenant.slug,
        role: result.membership.role,
        sessionVersion:result.user.authVersion,
      });
      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn: 28800,
        user: { id: result.user.id, name: result.user.name, email: result.user.email,isPlatformAdmin:result.user.isPlatformAdmin,mustChangePassword:result.user.mustChangePassword },
        tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug,kind:result.tenant.kind },
        role: result.membership.role,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("Já existe uma conta com este e-mail.");
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    this.secret();
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenant: { is: { status: "ACTIVE" } } },
          include: { tenant: true },
        },
      },
    });

    if (!user || !user.isActive || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const requestedSlug = input.tenantSlug.trim().toLowerCase();
    const exactMatches = user.memberships.filter((item) => item.tenant.slug === requestedSlug);
    const prefixMatches = user.memberships.filter((item) => item.tenant.slug.startsWith(`${requestedSlug}-`));
    const matches = exactMatches.length ? exactMatches : prefixMatches;
    if (matches.length !== 1) {
      throw new UnauthorizedException(
        matches.length > 1
          ? "Há mais de uma empresa com esse início de identificador. Informe o identificador completo."
          : "E-mail, senha ou identificador da empresa inválidos.",
      );
    }
    const membership = matches[0];
    if (!membership || membership.tenant.status !== "ACTIVE") {
      throw new UnauthorizedException("E-mail, senha ou identificador da empresa inválidos.");
    }

    const accessToken = await this.issueToken({
      sub: user.id,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
      sessionVersion:user.authVersion,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: 28800,
      user: { id: user.id, name: membership.knownBy?.trim()||user.name, email: user.email,isPlatformAdmin:user.isPlatformAdmin,mustChangePassword:user.mustChangePassword },
      tenant: { id: membership.tenant.id, name: membership.tenant.name, slug: membership.tenant.slug,kind:membership.tenant.kind },
      role: membership.role,
    };
  }


  async companies(userId:string){
    return this.prisma.membership.findMany({where:{userId,role:'OWNER',user:{isActive:true},tenant:{status:'ACTIVE'}},select:{tenant:{select:{id:true,name:true,slug:true,kind:true}}},orderBy:{tenant:{name:'asc'}}});
  }
  async companySession(userId:string,tenantId:unknown){return this.memberSession(userId,tenantId,true);}
  private async memberSession(userId:string,tenantId:unknown,ownerOnly:boolean){
    if(typeof tenantId!=='string'||!isUUID(tenantId))throw new BadRequestException('Selecione uma empresa válida.');
    const member=await this.prisma.membership.findFirst({where:{userId,tenantId,...(ownerOnly?{role:'OWNER' as const}:{}),user:{isActive:true},tenant:{status:'ACTIVE'}},include:{user:{select:{id:true,name:true,email:true,isPlatformAdmin:true,mustChangePassword:true,authVersion:true}},tenant:{select:{id:true,name:true,slug:true,kind:true}}}});
    if(!member||member.tenant.kind==='PLATFORM'&&!member.user.isPlatformAdmin)throw new ForbiddenException('Esta empresa não está vinculada à sua conta proprietária.');
    const {authVersion,...user}=member.user;
    return {accessToken:await this.issueToken({sub:userId,tenantId:member.tenant.id,tenantSlug:member.tenant.slug,role:member.role,sessionVersion:authVersion??0}),tokenType:'Bearer',expiresIn:28800,user:{...user,name:member.knownBy?.trim()||user.name},tenant:member.tenant,role:member.role};
  }
  async changePassword(userId:string,tenantId:string,input:any){
    if(typeof input?.currentPassword!=='string'||typeof input?.newPassword!=='string'||input.newPassword.length<12||input.newPassword.length>128||input.newPassword===input.currentPassword)throw new BadRequestException('Escolha uma nova senha de 12 a 128 caracteres, diferente da temporária.');
    const nextHash=await hash(input.newPassword,12);
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user=await tx.user.findUnique({where:{id:userId}});
      if(!user?.isActive||!await compare(input.currentPassword,user.passwordHash))throw new UnauthorizedException('A senha atual não confere.');
      await tx.user.update({where:{id:userId},data:{passwordHash:nextHash,mustChangePassword:false,authVersion:{increment:1}}});
      await tx.pushSubscription.deleteMany({where:{userId}});
      await tx.auditLog.create({data:{tenantId,userId,action:'user.password.changed',entityType:'user',entityId:userId}});
    });
    return this.memberSession(userId,tenantId,false);
  }
  async createCompany(userId:string,sourceTenantId:string,input:any){
    this.secret();
    if(typeof input?.name!=='string'||input.name.trim().length<2||input.name.trim().length>100||!SEGMENTS.some(s=>s.id===input.segmentId)||!isUUID(input.requestId||''))throw new BadRequestException('Informe nome, segmento e identificador da solicitação.');
    const platforms=Array.isArray(input.platforms)?input.platforms:[];
    if(input.platforms!==undefined&&!Array.isArray(input.platforms)||platforms.length>10||platforms.some((p:any)=>typeof p!=='string'||p.trim().length<2||p.trim().length>60)||new Set(platforms.map((p:string)=>p.trim().toLocaleLowerCase('pt-BR'))).size!==platforms.length)throw new BadRequestException('Informe até dez plataformas com nomes diferentes.');
    const tenant=await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      if(!await tx.membership.findFirst({where:{userId,tenantId:sourceTenantId,role:'OWNER',user:{isActive:true,isPlatformAdmin:true},tenant:{status:'ACTIVE'}},select:{id:true}}))throw new ForbiddenException('Somente a administração da Véxora pode criar empresas.');
      const existing=await tx.tenant.findFirst({where:{memberships:{some:{userId,role:'OWNER'}},integrations:{path:['onboarding','requestId'],equals:input.requestId}}});
      if(existing)return existing;
      if(await tx.membership.count({where:{userId,role:'OWNER'}})>=25)throw new BadRequestException('Limite de empresas atingido. Entre em contato com a administração.');
      const base=input.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'empresa';
      const tenant=await tx.tenant.create({data:{name:input.name.trim(),slug:base+'-'+randomBytes(5).toString('hex')}});
      await tx.membership.create({data:{tenantId:tenant.id,userId,role:'OWNER'}});
      await provisionCompany(tx,tenant,userId,input.segmentId,input.requestId,platforms.map((p:string)=>p.trim()));
      await tx.auditLog.create({data:{tenantId:tenant.id,userId,action:'company.created',entityType:'tenant',entityId:tenant.id,details:{segmentId:input.segmentId}}});
      return tenant;
    });
    return this.companySession(userId,tenant.id);
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error &&
      (error as { code?: string }).code === "P2002";
  }
}
