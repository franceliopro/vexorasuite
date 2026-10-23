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
        const tenant = await tx.tenant.create({
          data: { name: input.tenantName.trim(), slug },
        });
        const user = await tx.user.create({
          data: { name: input.name.trim(), email, passwordHash },
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
      });
      return {
        accessToken,
        tokenType: "Bearer",
        expiresIn: 28800,
        user: { id: result.user.id, name: result.user.name, email: result.user.email },
        tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
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
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { tenant: { slug: input.tenantSlug }, tenant: { status: "ACTIVE" } },
          include: { tenant: true },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const membership = user.memberships[0];
    if (!membership || membership.tenant.status !== "ACTIVE") {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const accessToken = await this.issueToken({
      sub: user.id,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: 28800,
      user: { id: user.id, name: user.name, email: user.email },
      tenant: { id: membership.tenant.id, name: membership.tenant.name, slug: membership.tenant.slug },
      role: membership.role,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error &&
      (error as { code?: string }).code === "P2002";
  }
}
