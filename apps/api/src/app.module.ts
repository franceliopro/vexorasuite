import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CommunicationsModule } from './communications/communications.module';
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { OperationsModule } from "./operations/operations.module";
import { AiModule } from "./ai/ai.module";
import { AuditInterceptor } from "./common/audit/audit.interceptor";
import { RateLimitInterceptor } from "./common/rate-limit/rate-limit.interceptor";
import { RateLimitService } from "./common/rate-limit/rate-limit.service";

@Module({
  imports: [PrismaModule, AuthModule, OperationsModule, AiModule, CommunicationsModule],
  controllers: [HealthController],
  providers: [
    RateLimitService,
    // Global: counts every request, authenticated ones per user and the rest per client IP.
    { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor },
    // Records every state-changing request that has no semantic entry of its own.
    AuditInterceptor,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
