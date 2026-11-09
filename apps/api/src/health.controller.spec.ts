import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { HealthController } from "./health.controller";
import { RateLimitService } from "./common/rate-limit/rate-limit.service";

describe("HealthController", () => {
  const makeController = (
    queryRaw: jest.Mock = jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    redisHealth: jest.Mock = jest.fn().mockResolvedValue("ok"),
    rateLimitEnabled = true,
  ) => {
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const rateLimit = { enabled: rateLimitEnabled, redisHealth } as unknown as RateLimitService;
    return new HealthController(prisma, rateLimit);
  };

  it("keeps the existing health endpoint reporting API and database readiness", async () => {
    await expect(makeController().health()).resolves.toMatchObject({
      status: "ok",
      service: "vexorasuite-api",
      database: "ok",
    });
  });

  it("returns unavailable when the database cannot be reached", async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error("database unavailable"));

    await expect(makeController(queryRaw).health()).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(makeController(queryRaw).ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("reports liveness without checking external dependencies", async () => {
    const controller = makeController(jest.fn().mockRejectedValue(new Error("database unavailable")));

    expect(controller.live()).toMatchObject({
      status: "ok",
      service: "vexorasuite-api",
    });
  });

  it("reports degraded readiness when Redis is required but unavailable", async () => {
    const redisHealth = jest.fn().mockResolvedValue("degraded");

    await expect(makeController(undefined, redisHealth).ready()).resolves.toMatchObject({
      status: "degraded",
      database: "ok",
      redis: "degraded",
    });
  });

  it("does not report degraded readiness when rate limiting is disabled", async () => {
    const redisHealth = jest.fn().mockResolvedValue("degraded");

    await expect(makeController(undefined, redisHealth, false).ready()).resolves.toMatchObject({
      status: "ok",
      database: "ok",
      redis: "degraded",
    });
  });

  it("reports Redis as not configured without failing readiness", async () => {
    const redisHealth = jest.fn().mockResolvedValue("not_configured");

    await expect(makeController(undefined, redisHealth).ready()).resolves.toMatchObject({
      status: "ok",
      database: "ok",
      redis: "not_configured",
    });
  });
});
