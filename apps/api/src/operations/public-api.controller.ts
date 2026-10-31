import { BadRequestException, Controller, Delete, ForbiddenException, Get, Headers, Param, ParseUUIDPipe, Post, Req, UnauthorizedException, UseGuards, Body } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function cleanName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80)
    throw new BadRequestException("Informe um nome para o token.");
  return value.trim();
}

@Controller("public-api")
export class PublicApiController {
  constructor(private readonly prisma: PrismaService) {}

  private admin(req: AuthenticatedRequest) {
    if (!req.user.isPlatformAdmin && !["OWNER", "ADMIN"].includes(req.user.role))
      throw new ForbiddenException("Somente administradores gerenciam tokens da API.");
  }

  @UseGuards(AuthGuard)
  @Get("tokens")
  async listTokens(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    return this.prisma.publicApiToken.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, name: true, lastUsedAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  @UseGuards(AuthGuard)
  @Post("tokens")
  async createToken(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.admin(req);
    const name = cleanName(body?.name);
    const token = "vx_live_" + randomBytes(32).toString("base64url");
    const row = await this.prisma.publicApiToken.create({
      data: { tenantId: req.user.tenantId, name, tokenHash: hashToken(token) },
      select: { id: true, name: true, createdAt: true },
    });
    return { ...row, token, warning: "Guarde este token agora. Ele não será exibido novamente." };
  }

  @UseGuards(AuthGuard)
  @Delete("tokens/:id")
  async revokeToken(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.admin(req);
    const result = await this.prisma.publicApiToken.updateMany({
      where: { id, tenantId: req.user.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new BadRequestException("Token não encontrado ou já revogado.");
    return { revoked: true };
  }

  private async resolveToken(value: string | undefined) {
    if (!value) throw new UnauthorizedException("Token da API obrigatório.");
    const token = value.startsWith("Bearer ") ? value.slice(7).trim() : value.trim();
    const row = await this.prisma.publicApiToken.findFirst({
      where: { tokenHash: hashToken(token), revokedAt: null, tenant: { status: "ACTIVE" } },
      select: { id: true, tenantId: true },
    });
    if (!row) throw new UnauthorizedException("Token da API inválido ou revogado.");
    await this.prisma.publicApiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    return row;
  }

  @Get("v1/health")
  async health(@Headers("x-vexora-api-key") key: string | undefined, @Headers("authorization") authorization: string | undefined) {
    await this.resolveToken(key || authorization);
    return { ok: true, version: "v1" };
  }

  @Get("v1/conversations")
  async conversations(
    @Headers("x-vexora-api-key") key: string | undefined,
    @Headers("authorization") authorization: string | undefined,
  ) {
    const token = await this.resolveToken(key || authorization);
    const rows = await this.prisma.conversation.findMany({
      where: { tenantId: token.tenantId, deletedAt: null, archivedAt: null },
      select: {
        id: true, status: true, priority: true, channel: true, subject: true,
        createdAt: true, updatedAt: true, lastMessageAt: true,
        contact: { select: { id: true, name: true, phone: true, email: true } },
        channelConnection: { select: { id: true, name: true, provider: true, status: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return { conversations: rows, limit: 100 };
  }
}
