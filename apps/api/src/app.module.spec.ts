import { Test } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { RefreshSessionService } from "./auth/refresh-session.service";
import { MailService } from "./mail/mail.service";
import { RateLimitService } from "./common/rate-limit/rate-limit.service";
import { PrismaService } from "./prisma/prisma.service";

/**
 * Assembles the real dependency graph.
 *
 * Every other test targets one class in isolation, so nothing asked Nest to resolve the whole
 * application: a missing provider, a controller/module that is not imported, or two services on the
 * opposite sides of the auth/mail boundary would only surface when the container starts.
 *
 * This covers the DI graph. Starting the compiled artifact is covered by `scripts/boot-check.cjs`,
 * which runs in the validate workflow against a migrated database.
 *
 * PrismaService is replaced so no database is needed; guards, interceptors and services are real.
 */
describe("AppModule", () => {
  it("assembles the whole graph without a circular dependency", async () => {
    const prisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn(),
      onModuleInit: undefined,
      onModuleDestroy: undefined,
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    try {
      // Providers that live on both sides of the auth/mail boundary must be resolvable.
      expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService);
      expect(moduleRef.get(AuthGuard)).toBeInstanceOf(AuthGuard);
      expect(moduleRef.get(MailService)).toBeInstanceOf(MailService);
      expect(moduleRef.get(RefreshSessionService)).toBeInstanceOf(RefreshSessionService);
      expect(moduleRef.get(RateLimitService)).toBeInstanceOf(RateLimitService);
    } finally {
      await moduleRef.close();
    }
  });
});
