import {ForbiddenException} from '@nestjs/common';
import {SEGMENTS} from '../operations/business-templates';
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest } from "./auth.types";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { PrismaService } from "../prisma/prisma.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("options")
  async options(){return {registrationEnabled:await this.prisma.tenant.count()===0};}

  @Post("register")
  register(@Body() input: RegisterDto, @Req() req: AuthenticatedRequest) {
    return this.auth.register(input, this.userAgent(req));
  }

  @Post("login")
  login(@Body() input: LoginDto, @Req() req: AuthenticatedRequest) {
    return this.auth.login(input, this.userAgent(req));
  }

  /** Public on purpose: it runs when the access token is already expired. The refresh token is the credential. */
  @Post("refresh")
  refresh(@Body() input: RefreshTokenDto, @Req() req: AuthenticatedRequest) {
    return this.auth.refresh(input.refreshToken, this.userAgent(req));
  }

  @Post("password/forgot")
  forgotPassword(@Body() input: ForgotPasswordDto, @Req() req: AuthenticatedRequest) {
    return this.auth.requestPasswordReset(input, this.clientAddress(req));
  }

  @Post("password/reset")
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.auth.resetPassword(input);
  }

  /**
   * Ends the session from the refresh token (durable) or from a still-valid access token.
   * Idempotent and anonymous-safe: an unknown credential answers `{ ok: true }` as well.
   */
  @Post("logout")
  logout(@Req() req: AuthenticatedRequest, @Body() body: { refreshToken?: unknown }) {
    const authorization = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
    return this.auth.logoutFrom({
      refreshToken: typeof body?.refreshToken === "string" ? body.refreshToken : undefined,
      accessToken: authorization.replace(/^Bearer\s+/i, "") || undefined,
    });
  }

  private clientAddress(req: AuthenticatedRequest): string {
    const address = req.ip || req.socket?.remoteAddress || "unknown";
    return address.slice(0, 120);
  }

  private userAgent(req: AuthenticatedRequest): string | undefined {
    const value = req.headers?.["user-agent"];
    return typeof value === "string" ? value : undefined;
  }

  private owner(req:AuthenticatedRequest){if(req.user.role!=='OWNER')throw new ForbiddenException('Apenas a conta proprietária gerencia empresas.');}
  @UseGuards(AuthGuard) @Get("organization")
  organization(@Req() req:AuthenticatedRequest){return this.auth.organization(req.user.tenantId);}
  @UseGuards(AuthGuard) @Get("bot-host")
  botHost(@Req() req:AuthenticatedRequest){return this.auth.botHost(req.user.tenantId);}
  @UseGuards(AuthGuard) @Patch("organization")
  updateOrganization(@Req() req:AuthenticatedRequest,@Body() body:any){return this.auth.updateOrganization(req.user.tenantId,req.user.role,body);}
  @UseGuards(AuthGuard) @Get("users")
  users(@Req() req:AuthenticatedRequest){return this.auth.listUsers(req.user.tenantId,req.user.role,req.user.isPlatformAdmin);}
  @UseGuards(AuthGuard) @Post("users")
  createUser(@Req() req:AuthenticatedRequest,@Body() body:any){return this.auth.createUser(req.user.tenantId,req.user.role,!!req.user.isPlatformAdmin,body);}
  @UseGuards(AuthGuard) @Patch("users/me")
  updateMyProfile(@Req() req:AuthenticatedRequest,@Body() body:any){return this.auth.updateUserProfile(req.user.sub,req.user.tenantId,body);}
  @UseGuards(AuthGuard) @Patch("users/:id/reset-password")
  resetUserPassword(@Req() req:AuthenticatedRequest,@Param("id") id:string){return this.auth.resetUserPassword(req.user.tenantId,req.user.role,req.user.isPlatformAdmin,id);}

  @UseGuards(AuthGuard) @Get('companies')
  async companies(@Req() req:AuthenticatedRequest){this.owner(req);const rows=await this.auth.companies(req.user.sub);return {companies:rows.map(r=>r.tenant),segments:SEGMENTS.map(s=>({id:s.id,name:s.name}))};}
  @UseGuards(AuthGuard) @Post('companies')
  createCompany(@Req() req:AuthenticatedRequest,@Body() body:any){this.owner(req);return this.auth.createCompany(req.user.sub,req.user.tenantId,body);}
  @UseGuards(AuthGuard) @Post('switch')
  switchCompany(@Req() req:AuthenticatedRequest,@Body() body:any){this.owner(req);return this.auth.companySession(req.user.sub,body?.tenantId,this.userAgent(req));}

  @UseGuards(AuthGuard) @Post("change-password")
  changePassword(@Req() req:AuthenticatedRequest,@Body() body:any){return this.auth.changePassword(req.user.sub,req.user.tenantId,body);}

  @UseGuards(AuthGuard)
  @Get("me")
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, name: true, email: true, isActive: true, isPlatformAdmin:true,mustChangePassword:true, avatarUrl: true, avatarSource: true, avatarCheckedAt: true },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { id: true, name: true, slug: true,kind:true, planId:true, plan:{select:{name:true,code:true,priceCents:true,cycle:true}} },
    });
    const membership=await this.prisma.membership.findFirst({where:{tenantId:request.user.tenantId,userId:request.user.sub},select:{knownBy:true}});
    return { user:user?{...user,fullName:user.name,knownBy:membership?.knownBy||"",name:membership?.knownBy?.trim()||user.name}:user, tenant, role: request.user.role, allowedModules:request.user.allowedModules||[], departmentIds:request.user.departmentIds||[] };
  }
}
