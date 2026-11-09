import { createHash, randomUUID } from "node:crypto";
import { RefreshSessionService, SessionExpiredError, SessionReuseError } from "./refresh-session.service";

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const RAW = "token-de-atualizacao-com-mais-de-vinte-caracteres";

function setup(options: { rows?: any[]; user?: any; claimCount?: number } = {}) {
  const created: any[] = [];
  const prisma: any = {
    refreshToken: {
      findUnique: jest.fn(async ({ where }: any) => (options.rows ?? []).find((row) => row.tokenHash === where.tokenHash) ?? null),
      updateMany: jest.fn(async (args: any) => {
        // The claim is the only call scoped to a single row id.
        if (args?.where?.id) return { count: options.claimCount ?? 1 };
        return { count: 1 };
      }),
      create: jest.fn(async ({ data }: any) => {
        created.push(data);
        return data;
      }),
    },
    user: { findUnique: jest.fn(async () => options.user ?? { isActive: true, authVersion: 0 }) },
  };
  const service = new RefreshSessionService(prisma);
  return { service, prisma, created };
}

const row = (overrides: any = {}) => ({
  id: randomUUID(),
  userId: randomUUID(),
  tenantId: randomUUID(),
  tokenHash: sha256(RAW),
  familyId: randomUUID(),
  sessionVersion: 0,
  expiresAt: new Date(Date.now() + 60_000),
  usedAt: null,
  revokedAt: null,
  userAgent: "jest",
  ...overrides,
});

describe("RefreshSessionService", () => {
  it("stores only the hash of the token it hands out", async () => {
    const { service, created } = setup();
    const issued = await service.issue({ userId: randomUUID(), tenantId: randomUUID(), sessionVersion: 0 });
    expect(issued.token.length).toBeGreaterThan(30);
    expect(created).toHaveLength(1);
    expect(created[0].tokenHash).toBe(sha256(issued.token));
    expect(JSON.stringify(created[0])).not.toContain(issued.token);
    // A 30-day session by default, not something adjustable by the caller.
    const days = (issued.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("rotates inside the same family and burns the presented token", async () => {
    const current = row();
    const { service, created, prisma } = setup({ rows: [current] });
    const rotated = await service.rotate(RAW);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: current.id, usedAt: null, revokedAt: null } }),
    );
    expect(created[0].familyId).toBe(current.familyId);
    expect(rotated.refreshToken).not.toBe(RAW);
    expect(rotated.userId).toBe(current.userId);
    expect(rotated.tenantId).toBe(current.tenantId);
  });

  it("revokes the whole family when a used token is presented again", async () => {
    const current = row({ usedAt: new Date() });
    const { service, prisma } = setup({ rows: [current] });
    await expect(service.rotate(RAW)).rejects.toBeInstanceOf(SessionReuseError);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: current.familyId, revokedAt: null } }),
    );
  });

  it("revokes the family when the token expired", async () => {
    const current = row({ expiresAt: new Date(Date.now() - 1000) });
    const { service, prisma } = setup({ rows: [current] });
    await expect(service.rotate(RAW)).rejects.toBeInstanceOf(SessionExpiredError);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ familyId: current.familyId }) }),
    );
  });

  it("dies when the password changed, because authVersion moved", async () => {
    const current = row({ sessionVersion: 3 });
    const { service } = setup({ rows: [current], user: { isActive: true, authVersion: 4 } });
    await expect(service.rotate(RAW)).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("refuses a token of a deactivated user", async () => {
    const { service } = setup({ rows: [row()], user: { isActive: false, authVersion: 0 } });
    await expect(service.rotate(RAW)).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("treats a lost race as reuse instead of issuing two sessions", async () => {
    const { service } = setup({ rows: [row()], claimCount: 0 });
    await expect(service.rotate(RAW)).rejects.toBeInstanceOf(SessionReuseError);
  });

  it("rejects a malformed or unknown token without touching the database", async () => {
    const { service, prisma } = setup();
    await expect(service.rotate("curto")).rejects.toBeInstanceOf(SessionExpiredError);
    await expect(service.rotate("x".repeat(40))).rejects.toBeInstanceOf(SessionExpiredError);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("keeps the ttl configurable but bounded", () => {
    const { service } = setup();
    process.env.AUTH_REFRESH_TTL_DAYS = "7";
    expect(service.ttlMs).toBe(7 * 86_400_000);
    process.env.AUTH_REFRESH_TTL_DAYS = "9999";
    expect(service.ttlMs).toBe(180 * 86_400_000);
    process.env.AUTH_REFRESH_TTL_DAYS = "zero";
    expect(service.ttlMs).toBe(30 * 86_400_000);
    delete process.env.AUTH_REFRESH_TTL_DAYS;
  });

  it("resolves the owner of an already used token so logout can end the session", async () => {
    const current = row({ usedAt: new Date() });
    const { service } = setup({ rows: [current] });
    await expect(service.ownerOf(RAW)).resolves.toEqual({ userId: current.userId, familyId: current.familyId });
    await expect(service.ownerOf("x")).resolves.toBeNull();
  });
});
