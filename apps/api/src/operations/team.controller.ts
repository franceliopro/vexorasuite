import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Controller("team")
@UseGuards(AuthGuard)
export class TeamController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("members")
  async members(@Req() request: AuthenticatedRequest) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId: request.user.tenantId },
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return memberships.map(({ role, createdAt, user }) => ({
      ...user,
      role,
      createdAt,
    }));
  }
}
