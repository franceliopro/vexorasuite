import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { RateLimitService } from "./common/rate-limit/rate-limit.service";

const service = "vexorasuite-api";

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get("health")
  async health() {
    await this.assertDatabase();
    return {
      status: "ok",
      service,
      database: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health/live")
  live() {
    return {
      status: "ok",
      service,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health/ready")
  async ready() {
    await this.assertDatabase();
    const redis = await this.rateLimit.redisHealth();
    return {
      // Readiness stays HTTP 200 so Compose does not restart the API for a degraded
      // optional dependency, while the body remains truthful for operators.
      status: this.rateLimit.enabled && redis === "degraded" ? "degraded" : "ok",
      service,
      database: "ok",
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  private async assertDatabase(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        service,
        database: "unavailable",
      });
    }
  }
}
