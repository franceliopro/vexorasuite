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
