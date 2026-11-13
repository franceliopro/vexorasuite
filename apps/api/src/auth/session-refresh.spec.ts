import { UnauthorizedException } from "@nestjs/common";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { AuthThrottle } from "./auth-throttle";
import { SessionExpiredError, SessionReuseError } from "./refresh-session.service";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "y".repeat(48);
});

const MEMBERSHIP = {
  knownBy: "",
  role: "AGENT",
  user: { id: "user-1", name: "Ana", email: "ana@exemplo.com", isPlatformAdmin: false, mustChangePassword: false, authVersion: 2 },
  tenant: { id: "tenant-1", name: "Rastreabem", slug: "rastreabem", kind: "CLIENT" },
};

function setup(options: { membership?: any; rotate?: () => Promise<any> } = {}) {
  const userUpdate = jest.fn().mockResolvedValue({});
  const prisma: any = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: userUpdate },
    membership: { findFirst: jest.fn(async () => (options.membership === undefined ? MEMBERSHIP : options.membership)) },
    refreshToken: { create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
  };
  const jwt: any = {
    signAsync: jest.fn().mockResolvedValue("access.jwt"),
    verifyAsync: jest.fn().mockResolvedValue({ sub: "user-1" }),
  };
  const sessions: any = {
    issue: jest.fn().mockResolvedValue({
      token: "refresh-token-value-1234567890",
      expiresAt: new Date(Date.now() + 86_400_000),
      familyId: randomUUID(),
    }),
    rotate: jest.fn(
      options.rotate ??
        (async () => ({
          userId: "user-1",
          tenantId: "tenant-1",
          sessionVersion: 0,
          refreshToken: "novo-token-de-atualizacao-123456",
          refreshExpiresAt: new Date(Date.now() + 86_400_000),
        })),
    ),
    revokeAll: jest.fn().mockResolvedValue(1),
    revokeFamily: jest.fn().mockResolvedValue(1),
    ownerOf: jest.fn().mockResolvedValue({ userId: "user-1", familyId: "family-1" }),
  };
  const service = new AuthService(prisma, jwt, new AuthThrottle(1000, 60_000), undefined, sessions);
  return { service, prisma, jwt, sessions, userUpdate };
}

describe("refresh", () => {
  it("issues a fresh access token and a rotated refresh token", async () => {
    const { service, jwt } = setup();
    const result = await service.refresh("token-antigo");
    expect(result.accessToken).toBe("access.jwt");
    expect(result.refreshToken).toBe("novo-token-de-atualizacao-123456");
    // Short access token: the refresh token is what lasts.
    expect(result.expiresIn).toBe(1800);
    expect(result.refreshExpiresIn).toBeGreaterThan(86_000);
    expect(result.tenant).toMatchObject({ slug: "rastreabem" });
    // authVersion is internal state and must not travel to the client.
    expect(JSON.stringify(result.user)).not.toContain("authVersion");
    expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ sub: "user-1", tenantId: "tenant-1", sessionVersion: 2 });
  });

  it("answers 401 when a used token is presented, without issuing anything", async () => {
    const { service } = setup({
      rotate: async () => {
        throw new SessionReuseError();
      },
    });
    await expect(service.refresh("token")).rejects.toThrow(/segurança/);
  });

  it("answers 401 when the token expired", async () => {
    const { service } = setup({
      rotate: async () => {
        throw new SessionExpiredError();
      },
    });
    await expect(service.refresh("token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revokes everything when the tenant link is gone", async () => {
    const { service, sessions } = setup({ membership: null });
    await expect(service.refresh("token")).rejects.toThrow(/revogado/);
    expect(sessions.revokeAll).toHaveBeenCalledWith("user-1");
  });

  it("lets an internal non-admin member of the PLATFORM workspace renew the session", async () => {
    const { service } = setup({
      membership: { ...MEMBERSHIP, tenant: { ...MEMBERSHIP.tenant, kind: "PLATFORM" } },
    });
    await expect(service.refresh("token")).resolves.toMatchObject({ accessToken: "access.jwt" });
  });

  it("respects a configured access token lifetime", async () => {
    process.env.AUTH_ACCESS_TTL_SECONDS = "900";
    const { service } = setup();
    await expect(service.refresh("token")).resolves.toMatchObject({ expiresIn: 900 });
    delete process.env.AUTH_ACCESS_TTL_SECONDS;
  });
});


describe("logout", () => {
  it("ends the session from the refresh token even with an expired access token", async () => {
    const { service, sessions, userUpdate } = setup();
    await expect(service.logoutFrom({ refreshToken: "token", accessToken: "expirado" })).resolves.toEqual({ ok: true });
    expect(sessions.revokeFamily).toHaveBeenCalledWith("family-1");
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { authVersion: { increment: 1 } } }));
    expect(sessions.revokeAll).toHaveBeenCalledWith("user-1");
  });

  it("still ends the session when only a valid access token is presented", async () => {
    const { service, sessions } = setup();
    await expect(service.logoutFrom({ accessToken: "valido" })).resolves.toEqual({ ok: true });
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
    expect(sessions.revokeAll).toHaveBeenCalledWith("user-1");
  });

  it("answers ok for an unknown credential without touching the account", async () => {
    const { service, sessions, userUpdate } = setup();
    sessions.ownerOf.mockResolvedValue(null);
    const result = await service.logoutFrom({ refreshToken: "inexistente" });
    expect(result).toEqual({ ok: true });
    expect(userUpdate).not.toHaveBeenCalled();
  });
});

describe("login", () => {
  it("returns the access and refresh pair and keeps authVersion out of the response", async () => {
    const { service, prisma, sessions } = setup();
    const passwordHash = await hash("umaSenhaMuitoForte1", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana",
      email: "ana@exemplo.com",
      isActive: true,
      isPlatformAdmin: false,
      mustChangePassword: false,
      authVersion: 2,
      passwordHash,
      memberships: [
        { tenantId: "tenant-1", role: "AGENT", knownBy: "", tenant: { ...MEMBERSHIP.tenant, status: "ACTIVE" } },
      ],
    });

    const result = await service.login(
      { tenantSlug: "rastreabem", email: "ana@exemplo.com", password: "umaSenhaMuitoForte1" },
      "jest",
    );
    expect(result).toMatchObject({ tokenType: "Bearer", expiresIn: 1800, refreshToken: "refresh-token-value-1234567890" });
    expect(sessions.issue).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", tenantId: "tenant-1", userAgent: "jest" }),
    );
    expect(JSON.stringify(result.user)).not.toContain("authVersion");
  });
});
