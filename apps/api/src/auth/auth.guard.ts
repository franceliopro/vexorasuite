import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { AuthPayload } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token de acesso obrigatório.");
    }

    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
      throw new UnauthorizedException("Autenticação não configurada.");
    }

    let payload: AuthPayload;
    try {
      payload = await this.jwt.verifyAsync<AuthPayload>(authorization.slice(7), { secret });
    } catch {
      throw new UnauthorizedException("Token inválido ou expirado.");
    }

    if (!payload.sub || !payload.tenantId || !payload.tenantSlug) {
      throw new UnauthorizedException("Token inválido.");
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: payload.sub,
        tenantId: payload.tenantId,
        tenant: { status: "ACTIVE" },
        user: { isActive: true },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new UnauthorizedException("Acesso à empresa revogado.");
    }

    request.user = { ...payload, role: membership.role };
    return true;
  }
}
