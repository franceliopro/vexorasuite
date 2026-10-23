import { ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("reports API and database readiness", async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    await expect(controller.health()).resolves.toMatchObject({
      status: "ok",
      service: "vexorasuite-api",
      database: "ok",
    });
  });

  it("returns unavailable when the database cannot be reached", async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error("database unavailable")) } as unknown as PrismaService;
    const controller = new HealthController(prisma);

    await expect(controller.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
