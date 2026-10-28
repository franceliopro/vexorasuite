import {ForbiddenException} from '@nestjs/common';
import {SEGMENTS} from '../operations/business-templates';
import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
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

  @Post("register")
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post("login")
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }

  private owner(req:AuthenticatedRequest){if(req.user.role!=='OWNER')throw new ForbiddenException('Apenas a conta proprietária gerencia empresas.');}
  @UseGuards(AuthGuard) @Get('companies')
  async companies(@Req() req:AuthenticatedRequest){this.owner(req);const rows=await this.auth.companies(req.user.sub);return {companies:rows.map(r=>r.tenant),segments:SEGMENTS.map(s=>({id:s.id,name:s.name}))};}
  @UseGuards(AuthGuard) @Post('companies')
  createCompany(@Req() req:AuthenticatedRequest,@Body() body:any){this.owner(req);return this.auth.createCompany(req.user.sub,req.user.tenantId,body);}
  @UseGuards(AuthGuard) @Post('switch')
  switchCompany(@Req() req:AuthenticatedRequest,@Body() body:any){this.owner(req);return this.auth.companySession(req.user.sub,body?.tenantId);}

  @UseGuards(AuthGuard)
  @Get("me")
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, name: true, email: true, isActive: true, avatarUrl: true, avatarSource: true, avatarCheckedAt: true },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.user.tenantId },
      select: { id: true, name: true, slug: true },
    });
    return { user, tenant, role: request.user.role, allowedModules:request.user.allowedModules||[], departmentIds:request.user.departmentIds||[] };
  }
}
