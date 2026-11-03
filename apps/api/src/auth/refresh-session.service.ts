import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/** The refresh token exists but can no longer be used (expired, revoked, or superseded). */
export class SessionExpiredError extends Error {}
/** A token that was already exchanged was presented again: the family is compromised. */
export class SessionReuseError extends Error {}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
  familyId: string;
}

export interface RotatedSession {
  userId: string;
  tenantId: string;
  sessionVersion: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const hash = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

/**
 * Refresh tokens with rotation and reuse detection.
 *
 * The access token stays short-lived (minutes); this row is what keeps the session alive across
 * days. Two rules make it safe:
 *
 * - only the SHA-256 is stored, so a database leak cannot be replayed against the API;
 * - every exchange marks the presented token as used and issues a new one in the same family. If a
 *   used token shows up again, two clients hold the same secret: the whole family is revoked
 *   instead of silently continuing.
 *
 * `sessionVersion` mirrors `User.authVersion`. Every place that ends sessions (logout, password
 * change, password reset, admin reset) already increments it, so those tokens die without having to
 * remember to touch this table.
 */
@Injectable()
export class RefreshSessionService {
  private readonly logger = new Logger(RefreshSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** `AUTH_REFRESH_TTL_DAYS`, clamped to a sane range instead of trusting the environment. */
  get ttlMs(): number {
    const days = Number(process.env.AUTH_REFRESH_TTL_DAYS || 30);
    const safe = Number.isFinite(days) && days >= 1 ? Math.min(180, days) : 30;
    return safe * 24 * 60 * 60 * 1000;
  }

  async issue(input: {
    userId: string;
    tenantId: string;
    sessionVersion: number;
    userAgent?: string;
    familyId?: string;
  }): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString("base64url");
    const familyId = input.familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        tokenHash: hash(token),
        familyId,
        sessionVersion: input.sessionVersion,
        expiresAt,
        userAgent: input.userAgent?.slice(0, 200) ?? null,
      },
    });
    return { token, expiresAt, familyId };
  }

  /**
   * Exchanges a refresh token for a new one.
   *
   * Everything that makes the token unusable revokes the family, because the only reason to present
   * a dead token is that someone else already has it.
   */
  async rotate(token: string, meta: { userAgent?: string } = {}): Promise<RotatedSession> {
    if (typeof token !== "string" || token.length < 20 || token.length > 200) throw new SessionExpiredError();

    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) } });
    if (!row) throw new SessionExpiredError();

    const now = new Date();
    if (row.usedAt) {
      await this.revokeFamily(row.familyId);
      this.logger.warn(`Token de atualização reutilizado para o usuário ${row.userId}: família revogada.`);
      throw new SessionReuseError();
    }
    if (row.revokedAt || row.expiresAt.getTime() <= now.getTime()) {
      await this.revokeFamily(row.familyId);
      throw new SessionExpiredError();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
      select: { isActive: true, authVersion: true },
    });
    if (!user?.isActive || user.authVersion !== row.sessionVersion) {
      await this.revokeFamily(row.familyId);
      throw new SessionExpiredError();
    }

    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, usedAt: null, revokedAt: null },
      data: { usedAt: now, lastUsedAt: now, userAgent: meta.userAgent?.slice(0, 200) ?? row.userAgent },
    });
    if (claimed.count !== 1) {
      // Another request consumed it between the read and the write.
      await this.revokeFamily(row.familyId);
      throw new SessionReuseError();
    }

    const next = await this.issue({
      userId: row.userId,
      tenantId: row.tenantId,
      sessionVersion: row.sessionVersion,
      userAgent: meta.userAgent ?? row.userAgent ?? undefined,
      familyId: row.familyId,
    });
    return {
      userId: row.userId,
      tenantId: row.tenantId,
      sessionVersion: row.sessionVersion,
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    };
  }

  /** Resolves the owner of a token even if it is already used, so logout can end the session. */
  async ownerOf(token: string): Promise<{ userId: string; familyId: string } | null> {
    if (typeof token !== "string" || token.length < 20) return null;
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash(token) },
      select: { userId: true, familyId: true },
    });
    return row ? { userId: row.userId, familyId: row.familyId } : null;
  }

  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAll(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
