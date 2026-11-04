import { AuthThrottle } from "./auth-throttle";

import {BadRequestException,ForbiddenException,Optional} from '@nestjs/common';
import {isUUID} from 'class-validator';
import {SEGMENTS} from '../operations/business-templates';
import {provisionCompany} from './company-blueprint';
import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { MembershipRole } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthPayload } from "./auth.types";
import { MailService } from "../mail/mail.service";
import { RefreshSessionService, SessionReuseError } from "./refresh-session.service";
import { renderEmail } from "../mail/mail.template";
import { assertPasswordResetTargetAllowed } from "./password-reset-policy";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    // Optional so existing unit tests and scripted callers keep working.
    private readonly throttle: AuthThrottle = new AuthThrottle(),
    @Optional() private readonly mail?: MailService,
    @Optional() private readonly sessions?: RefreshSessionService,
  ) {}

  /**
   * Access token lifetime. Short on purpose: the refresh token keeps the session alive, so a leaked
   * access token is worth minutes instead of hours.
   */
  get accessTtlSeconds(): number {
    const configured = Number(process.env.AUTH_ACCESS_TTL_SECONDS || 1800);
    return Number.isFinite(configured) && configured >= 300 ? Math.min(28800, Math.floor(configured)) : 1800;
  }

  private temporaryPassword(): string {
    return "Vx!" + randomBytes(24).toString("base64url");
  }

  /** Refresh token fields, omitted when the session service is not wired (unit tests). */
  private async refreshFields(userId: string, tenantId: string, sessionVersion: number, userAgent?: string) {
    if (!this.sessions) return {};
    const issued = await this.sessions.issue({ userId, tenantId, sessionVersion, userAgent });
    return {
      refreshToken: issued.token,
      refreshExpiresIn: Math.max(1, Math.floor((issued.expiresAt.getTime() - Date.now()) / 1000)),
    };
  }

  /** Link lifetime; short enough that a leaked mailbox does not stay useful. */
  private get resetTtlMinutes(): number {
    const configured = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
    return Number.isFinite(configured) && configured >= 5 ? Math.min(120, configured) : 30;
  }

  /**
   * Starts a password reset.
   *
   * The answer is always the same, whether or not the address exists: the endpoint cannot be used
   * to discover which e-mails have an account. Delivery problems are logged by MailService and
   * never reported here.
   */
  async requestPasswordReset(input: { email: string; tenantSlug?: string }): Promise<{ accepted: true }> {
    this.secret();
    const email = input.email.trim().toLowerCase();
    const throttleKey = `reset:${email}`;
    await this.throttle.assertAllowed(throttleKey);
    await this.throttle.recordFailure(throttleKey);

    const slug = input.tenantSlug?.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isActive: true,
        ...(slug
          ? { memberships: { some: { tenant: { slug, status: "ACTIVE" } } } }
          : {}),
      },
      select: { id: true, email: true, name: true },
    });
    if (!user) return { accepted: true };

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + this.resetTtlMinutes * 60_000);
    await this.prisma.$transaction(async (tx) => {
      // A new request invalidates every link issued before it.
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    });

    const origin = (process.env.PUBLIC_APP_URL || process.env.WEB_PUBLIC_URL || "http://localhost:3000").replace(/\/+$/, "");
    const link = `${origin}/?reset=${encodeURIComponent(token)}`;
    const { html, text } = renderEmail({
      title: "Redefinir sua senha",
      intro: `Olá, ${user.name}. Recebemos um pedido para redefinir a senha da sua conta na Véxora Suite.`,
      action: { label: "Criar nova senha", url: link },
      footnote: `O link expira em ${this.resetTtlMinutes} minutos e só pode ser usado uma vez. Se não foi você, ignore esta mensagem: sua senha continua a mesma.`,
    });
    await this.mail?.send({ to: user.email, subject: "Véxora Suite — redefinição de senha", text, html });
    return { accepted: true };
  }

  /**
   * Completes a reset with a single-use token.
   *
   * The token is consumed inside the same transaction that writes the new password, and every
   * session is invalidated through `authVersion`, so a stolen session cannot outlive the reset.
   */
  async resetPassword(input: { token: string; password: string }): Promise<{ reset: true }> {
    this.secret();
    const invalid = new BadRequestException("Este link de redefinição expirou ou já foi usado. Solicite outro.");
    const tokenHash = createHash("sha256").update(input.token, "utf8").digest("hex");
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, isActive: true } } },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now() || !record.user.isActive) throw invalid;

    const passwordHash = await hash(input.password, 12);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      // Losing the race means another request already consumed this token.
      if (claimed.count !== 1) throw invalid;
      await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangePassword: false, authVersion: { increment: 1 } },
      });
    });
    return { reset: true };
  }

  private secret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
      throw new InternalServerErrorException("Autenticação indisponível: configure JWT_ACCESS_SECRET com pelo menos 32 bytes.");
    }
    return secret;
  }

  private async issueToken(payload: AuthPayload): Promise<string> {
    return this.jwt.signAsync(payload, { secret: this.secret(), expiresIn: this.accessTtlSeconds });
  }

  async register(input: RegisterDto, userAgent?: string) {
    this.secret();
    const email = input.email.trim().toLowerCase();
    const throttleKey = `register:${email}`;
    await this.throttle.assertAllowed(throttleKey);
    await this.throttle.recordFailure(throttleKey);
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
        expiresIn: this.accessTtlSeconds,
        ...(await this.refreshFields(result.user.id, result.tenant.id, result.user.authVersion, userAgent)),
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

  async login(input: LoginDto, userAgent?: string) {
    this.secret();
    const email = input.email.trim().toLowerCase();
    const throttleKey = `login:${input.tenantSlug.trim().toLowerCase()}:${email}`;
    await this.throttle.assertAllowed(throttleKey);
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
      await this.throttle.recordFailure(throttleKey);
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const requestedSlug = input.tenantSlug.trim().toLowerCase();
    const exactMatches = user.memberships.filter((item) => item.tenant.slug === requestedSlug);
    const prefixMatches = user.memberships.filter((item) => item.tenant.slug.startsWith(`${requestedSlug}-`));
    const matches = exactMatches.length ? exactMatches : prefixMatches;
    if (matches.length !== 1) {
      await this.throttle.recordFailure(throttleKey);
      throw new UnauthorizedException(
        matches.length > 1
          ? "Há mais de uma empresa com esse início de identificador. Informe o identificador completo."
          : "E-mail, senha ou identificador da empresa inválidos.",
      );
    }
    const membership = matches[0];
    if (!membership || membership.tenant.status !== "ACTIVE") {
      await this.throttle.recordFailure(throttleKey);
      throw new UnauthorizedException("E-mail, senha ou identificador da empresa inválidos.");
    }
    await this.throttle.clear(throttleKey);

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
      expiresIn: this.accessTtlSeconds,
      ...(await this.refreshFields(user.id, membership.tenantId, user.authVersion, userAgent)),
      user: { id: user.id, name: membership.knownBy?.trim()||user.name, email: user.email,isPlatformAdmin:user.isPlatformAdmin,mustChangePassword:user.mustChangePassword },
      tenant: { id: membership.tenant.id, name: membership.tenant.name, slug: membership.tenant.slug,kind:membership.tenant.kind },
      role: membership.role,
    };
  }


  /**
   * Invalidate every access token issued to this user.
   * AuthGuard compares the token sessionVersion with authVersion on each request,
   * so this takes effect immediately without waiting for the JWT expiry.
   */
  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
    });
    // Rows are already unusable through sessionVersion, but leaving them behind would keep a usable
    // secret in the database for the rest of its lifetime.
    await this.sessions?.revokeAll(userId);
    return { ok: true };
  }

  /**
   * Ends the session identified by the presented credential.
   *
   * The refresh token is tried first because it is the durable one — the access token is often
   * already expired when someone clicks "sair" after a while. An unknown credential still returns
   * `{ ok: true }`, so the endpoint cannot be used to probe which tokens exist.
   */
  async logoutFrom(input: { refreshToken?: string; accessToken?: string }) {
    let userId: string | undefined;
    if (input.refreshToken && this.sessions) {
      const owner = await this.sessions.ownerOf(input.refreshToken);
      if (owner) {
        userId = owner.userId;
        await this.sessions.revokeFamily(owner.familyId);
      }
    }
    if (!userId && input.accessToken) {
      try {
        const payload = await this.jwt.verifyAsync<AuthPayload>(input.accessToken, { secret: this.secret() });
        userId = payload.sub;
      } catch {
        // Expired or invalid: there is nothing to end, and the caller still gets a clean logout.
      }
    }
    if (!userId) return { ok: true };
    return this.logout(userId);
  }

  /**
   * Exchanges a refresh token for a new session.
   *
   * The tenancy is re-read from the database on every exchange: a user removed from the company, a
   * deactivated account or a platform tenant without a platform administrator must not be able to
   * extend a session that the access token still describes.
   */
  async refresh(refreshToken: string, userAgent?: string) {
    this.secret();
    const sessions = this.sessions;
    if (!sessions) throw new UnauthorizedException("Atualização de sessão indisponível.");

    let rotated: Awaited<ReturnType<RefreshSessionService["rotate"]>>;
    try {
      rotated = await sessions.rotate(refreshToken, { userAgent });
    } catch (error) {
      if (error instanceof SessionReuseError) {
        throw new UnauthorizedException("Sessão encerrada por segurança. Entre novamente.");
      }
      throw new UnauthorizedException("Sua sessão expirou. Entre novamente.");
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: rotated.userId,
        tenantId: rotated.tenantId,
        tenant: { status: "ACTIVE" },
        user: { isActive: true },
      },
      include: {
        user: { select: { id: true, name: true, email: true, isPlatformAdmin: true, mustChangePassword: true, authVersion: true } },
        tenant: { select: { id: true, name: true, slug: true, kind: true } },
      },
    });
    if (!membership) {
      await sessions.revokeAll(rotated.userId);
      throw new UnauthorizedException("Acesso à empresa revogado.");
    }
    if (membership.tenant.kind === "PLATFORM" && !membership.user?.isPlatformAdmin) {
      await sessions.revokeAll(rotated.userId);
      throw new ForbiddenException("Este painel pertence à administração da Véxora.");
    }

    const { authVersion, ...user } = membership.user;
    const accessToken = await this.issueToken({
      sub: rotated.userId,
      tenantId: membership.tenant.id,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
      sessionVersion: authVersion ?? 0,
    });
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.accessTtlSeconds,
      refreshToken: rotated.refreshToken,
      refreshExpiresIn: Math.max(1, Math.floor((rotated.refreshExpiresAt.getTime() - Date.now()) / 1000)),
      user: { ...user, name: membership.knownBy?.trim() || user.name },
      tenant: membership.tenant,
      role: membership.role,
    };
  }

  async companies(userId:string){
    return this.prisma.membership.findMany({where:{userId,role:'OWNER',user:{isActive:true},tenant:{status:'ACTIVE'}},select:{tenant:{select:{id:true,name:true,slug:true,kind:true}}},orderBy:{tenant:{name:'asc'}}});
  }
  async companySession(userId:string,tenantId:unknown,userAgent?:string){return this.memberSession(userId,tenantId,true,userAgent);}
  private async memberSession(userId:string,tenantId:unknown,ownerOnly:boolean,userAgent?:string){
    if(typeof tenantId!=='string'||!isUUID(tenantId))throw new BadRequestException('Selecione uma empresa válida.');
    const member=await this.prisma.membership.findFirst({where:{userId,tenantId,...(ownerOnly?{role:'OWNER' as const}:{}),user:{isActive:true},tenant:{status:'ACTIVE'}},include:{user:{select:{id:true,name:true,email:true,isPlatformAdmin:true,mustChangePassword:true,authVersion:true}},tenant:{select:{id:true,name:true,slug:true,kind:true}}}});
    if(!member||member.tenant.kind==='PLATFORM'&&!member.user?.isPlatformAdmin)throw new ForbiddenException('Esta empresa não está vinculada à sua conta proprietária.');
    const {authVersion,...user}=member.user;
    return {accessToken:await this.issueToken({sub:userId,tenantId:member.tenant.id,tenantSlug:member.tenant.slug,role:member.role,sessionVersion:authVersion??0}),tokenType:'Bearer',expiresIn:this.accessTtlSeconds,...(await this.refreshFields(userId,member.tenant.id,authVersion??0,userAgent)),user:{...user,name:member.knownBy?.trim()||user.name},tenant:member.tenant,role:member.role};
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
  private assertUserAdministration(role:string,isPlatformAdmin?:boolean){if(!isPlatformAdmin&&!["OWNER","ADMIN"].includes(role))throw new ForbiddenException("Somente Administradores podem gerenciar usuários.");}
  async listUsers(tenantId:string,role:string,isPlatformAdmin?:boolean){
    this.assertUserAdministration(role,isPlatformAdmin);
    const rows=await this.prisma.membership.findMany({where:{tenantId,user:{isActive:true}},orderBy:{user:{name:"asc"}},select:{role:true,knownBy:true,user:{select:{id:true,name:true,email:true,avatarUrl:true,isActive:true,mustChangePassword:true,createdAt:true}}}});
    return rows.map(row=>({...row.user,displayName:row.knownBy.trim()||row.user.name,role:row.role}));
  }
  async createUser(tenantId:string,role:string,isPlatformAdmin:boolean|undefined,input:any){
    this.assertUserAdministration(role,isPlatformAdmin);
    const name=typeof input?.name==="string"?input.name.trim():"";
    const email=typeof input?.email==="string"?input.email.trim().toLowerCase():"";
    const memberRole=["ADMIN","MANAGER","AGENT"].includes(String(input?.role))?String(input.role):"AGENT";
    if(name.length<2||name.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException("Informe nome e e-mail válidos.");
    const temporaryPassword=this.temporaryPassword();
    const passwordHash=await hash(temporaryPassword,12);
    try{
      const created=await this.prisma.$transaction(async tx=>{
        const user=await tx.user.create({data:{name,email,passwordHash,mustChangePassword:true}});
        await tx.membership.create({data:{tenantId,userId:user.id,role:memberRole as MembershipRole,knownBy:name}});
        return user;
      });
      return {id:created.id,name:created.name,email:created.email,role:memberRole,avatarUrl:created.avatarUrl,mustChangePassword:true,temporaryPassword};
    }catch(error:any){if(error?.code==="P2002")throw new ConflictException("Já existe um usuário com este e-mail.");throw error;}
  }
  async updateUserProfile(userId:string,tenantId:string,input:any){
    const name=typeof input?.name==="string"?input.name.trim():undefined;
    const email=typeof input?.email==="string"?input.email.trim().toLowerCase():undefined;
    const avatarUrl=input?.avatarUrl===null?"":typeof input?.avatarUrl==="string"?input.avatarUrl.trim():undefined;
    if(name!==undefined&&(name.length<2||name.length>120))throw new BadRequestException("Informe um nome válido.");
    if(email!==undefined&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException("Informe um e-mail válido.");
    try{
      const user=await this.prisma.$transaction(async tx=>{
        const membership=await tx.membership.findUnique({where:{tenantId_userId:{tenantId,userId}},select:{id:true}});
        if(!membership)throw new ForbiddenException("Usuário não pertence a esta empresa.");
        return tx.user.update({where:{id:userId},data:{...(name!==undefined?{name}:{}),...(email!==undefined?{email}:{}),...(avatarUrl!==undefined?{avatarUrl:avatarUrl||null,avatarSource:"profile"}:{})},select:{id:true,name:true,email:true,avatarUrl:true,mustChangePassword:true}});
      });
      return user;
    }catch(error:any){if(error?.code==="P2002")throw new ConflictException("Já existe um usuário com este e-mail.");throw error;}
  }
  async resetUserPassword(actorTenantId:string,actorRole:string,actorPlatformAdmin:boolean|undefined,userId:string){
    this.assertUserAdministration(actorRole,actorPlatformAdmin);
    const membership=await this.prisma.membership.findUnique({where:{tenantId_userId:{tenantId:actorTenantId,userId}},select:{id:true,user:{select:{isPlatformAdmin:true}}}});
    if(!membership)throw new ForbiddenException("Usuário não pertence a esta empresa.");
    assertPasswordResetTargetAllowed(actorPlatformAdmin,membership.user.isPlatformAdmin);
    const temporaryPassword=this.temporaryPassword();
    const passwordHash=await hash(temporaryPassword,12);
    await this.prisma.user.update({where:{id:userId},data:{passwordHash,mustChangePassword:true,authVersion:{increment:1}}});
    return {ok:true,temporaryPassword};
  }

  async organization(tenantId:string){const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true,integrations:true}});const root=(tenant.integrations||{}) as Record<string,any>;return {name:tenant.name,cnpj:root.organization?.cnpj||"",legalName:root.organization?.legalName||"",address:root.organization?.address||"",city:root.organization?.city||"",state:root.organization?.state||"",zipCode:root.organization?.zipCode||""};}
  async updateOrganization(tenantId:string,role:string,input:any){if(!['OWNER','ADMIN'].includes(role))throw new ForbiddenException('Somente administradores alteram os dados da empresa.');const values=['name','cnpj','legalName','address','city','state','zipCode'];for(const key of values)if(input?.[key]!==undefined&&typeof input[key]!=='string')throw new BadRequestException('Dados da empresa inválidos.');const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:tenantId},select:{name:true,integrations:true}});const root=(tenant.integrations||{}) as Record<string,any>;const organization:Record<string,string>=Object.fromEntries(values.map(key=>[key,String(input?.[key]??(key==="name"?tenant.name:root.organization?.[key]||""))]));const nextName=(organization.name||"").trim();if(nextName.length<2||nextName.length>120)throw new BadRequestException('Informe um nome válido para a empresa.');const updated=await this.prisma.tenant.update({where:{id:tenantId},data:{name:nextName,integrations:{...root,organization} as any},select:{name:true,integrations:true}});return {name:updated.name,...organization};}

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
