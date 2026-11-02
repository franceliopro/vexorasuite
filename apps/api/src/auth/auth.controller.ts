import {ForbiddenException} from '@nestjs/common';
import {SEGMENTS} from '../operations/business-templates';
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest } from "./auth.types";
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
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post("login")
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }

  private owner(req:AuthenticatedRequest){if(req.user.role!=='OWNER')throw new ForbiddenException('Apenas a conta proprietária gerencia empresas.');}
  @UseGuards(AuthGuard) @Get("organization")
  organization(@Req() req:AuthenticatedRequest){return this.auth.organization(req.user.tenantId);}
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
  switchCompany(@Req() req:AuthenticatedRequest,@Body() body:any){this.owner(req);return this.auth.companySession(req.user.sub,body?.tenantId);}

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
      select: { id: true, name: true, slug: true,kind:true },
    });
    const membership=await this.prisma.membership.findFirst({where:{tenantId:request.user.tenantId,userId:request.user.sub},select:{knownBy:true}});
    return { user:user?{...user,fullName:user.name,knownBy:membership?.knownBy||"",name:membership?.knownBy?.trim()||user.name}:user, tenant, role: request.user.role, allowedModules:request.user.allowedModules||[], departmentIds:request.user.departmentIds||[] };
  }
}
