import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { AuthThrottle } from "./auth-throttle";
import { AuthService } from "./auth.service";

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

interface Options {
  user?: { id: string; email: string; name: string } | null;
  record?: any;
  consumeCount?: number;
}

function setup(options: Options = {}) {
  const created: any[] = [];
  const userUpdate = jest.fn().mockResolvedValue({});
  const tokenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = {
    passwordResetToken: {
      updateMany: jest.fn(async (args: any) => {
        if (args?.where?.usedAt === null && args?.data && "usedAt" in args.data) return { count: 1 };
        return { count: options.consumeCount ?? 1 };
      }),
      create: jest.fn(async (args: any) => {
        created.push(args.data);
        return { id: "token-id", ...args.data };
      }),
    },
    user: { update: userUpdate },
  };
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue(options.user === undefined ? null : options.user),
      findUnique: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn().mockResolvedValue(options.record ?? null),
      updateMany: tokenUpdateMany,
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const mail = { send: jest.fn().mockResolvedValue({ delivered: true, transport: "smtp" }) } as any;
  const service = new AuthService(prisma, {} as any, new AuthThrottle(1000, 60_000), mail);
  return { service, prisma, mail, tx, created, userUpdate };
}

const USER = { id: "user-1", email: "ana@exemplo.com", name: "Ana" };

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "x".repeat(40);
  process.env.PUBLIC_APP_URL = "https://app.vexorasuite.com.br";
});

describe("password reset — request", () => {
  it("answers the same way for an unknown address and sends nothing", async () => {
    const { service, mail, created } = setup({ user: null });
    await expect(service.requestPasswordReset({ email: "ninguem@exemplo.com" })).resolves.toEqual({ accepted: true });
    expect(mail.send).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("stores only the hash, serves a single-use link and never reveals delivery", async () => {
    const { service, mail, created } = setup({ user: USER });
    await expect(service.requestPasswordReset({ email: "ANA@exemplo.com " })).resolves.toEqual({ accepted: true });

    expect(created).toHaveLength(1);
    const stored = created[0];
    const link = String(mail.send.mock.calls[0][0].html).match(/reset=([^"&]+)/)?.[1] ?? "";
    const rawToken = decodeURIComponent(link);
    expect(rawToken.length).toBeGreaterThan(20);
    // The database never holds the raw token, only its hash.
    expect(stored.tokenHash).toBe(sha256(rawToken));
    expect(JSON.stringify(stored)).not.toContain(rawToken);
    // 30 minutes by default.
    const ttl = stored.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29 * 60_000);
    expect(ttl).toBeLessThanOrEqual(30 * 60_000 + 1000);
    expect(mail.send.mock.calls[0][0].to).toBe("ana@exemplo.com");
  });

  it("invalidates every previous link when a new one is requested", async () => {
    const { service, tx } = setup({ user: USER });
    await service.requestPasswordReset({ email: "ana@exemplo.com" });
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", usedAt: null } }),
    );
  });

  it("narrows by company identifier when it is provided", async () => {
    const { service, prisma } = setup({ user: USER });
    await service.requestPasswordReset({ email: "ana@exemplo.com", tenantSlug: "rastreabem" });
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject({
      memberships: { some: { tenant: { slug: "rastreabem", status: "ACTIVE" } } },
    });
  });

  it("throttles repeated requests for the same address", async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const service = new AuthService(prisma, {} as any, new AuthThrottle(1, 60_000), { send: jest.fn() } as any);
    await expect(service.requestPasswordReset({ email: "ana@exemplo.com" })).resolves.toEqual({ accepted: true });
    await expect(service.requestPasswordReset({ email: "ana@exemplo.com" })).rejects.toThrow(/Muitas tentativas/);
  });
});

describe("password reset — completion", () => {
  const record = (overrides: any = {}) => ({
    id: "token-id",
    userId: "user-1",
    tokenHash: sha256("segredo"),
    usedAt: null,
    expiresAt: new Date(Date.now() + 10 * 60_000),
    user: { id: "user-1", isActive: true },
    ...overrides,
  });

  it("writes the new password, consumes the token and drops every session", async () => {
    const { service, userUpdate, tx } = setup({ record: record() });
    await expect(service.resetPassword({ token: "segredo", password: "umaSenhaMuitoForte1" })).resolves.toEqual({ reset: true });
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const data = userUpdate.mock.calls[0][0].data;
    expect(data.mustChangePassword).toBe(false);
    expect(data.authVersion).toEqual({ increment: 1 });
    // The stored hash is bcrypt, never the raw password.
    expect(data.passwordHash).not.toBe("umaSenhaMuitoForte1");
    expect(String(data.passwordHash)).toMatch(/^\$2[aby]\$/);
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "token-id", usedAt: null } }),
    );
  });

  it("rejects an already used link", async () => {
    const { service } = setup({ record: record({ usedAt: new Date() }) });
    await expect(service.resetPassword({ token: "segredo", password: "umaSenhaMuitoForte1" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an expired link", async () => {
    const { service } = setup({ record: record({ expiresAt: new Date(Date.now() - 1000) }) });
    await expect(service.resetPassword({ token: "segredo", password: "umaSenhaMuitoForte1" })).rejects.toThrow(/expirou/);
  });

  it("rejects an unknown token", async () => {
    const { service } = setup({ record: null });
    await expect(service.resetPassword({ token: "qualquer", password: "umaSenhaMuitoForte1" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a link of a deactivated user", async () => {
    const { service } = setup({ record: record({ user: { id: "user-1", isActive: false } }) });
    await expect(service.resetPassword({ token: "segredo", password: "umaSenhaMuitoForte1" })).rejects.toThrow(/expirou/);
  });

  it("rejects when another request consumed the token first", async () => {
    const { service, tx } = setup({ record: record(), consumeCount: 0 });
    tx.passwordResetToken.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.resetPassword({ token: "segredo", password: "umaSenhaMuitoForte1" })).rejects.toThrow(/expirou/);
  });
});
