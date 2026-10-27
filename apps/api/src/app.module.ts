import { Module } from "@nestjs/common";
import { CommunicationsModule } from './communications/communications.module';
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { OperationsModule } from "./operations/operations.module";
import { AiModule } from "./ai/ai.module";

@Module({
  imports: [PrismaModule, AuthModule, OperationsModule, AiModule, CommunicationsModule],
  controllers: [HealthController],
})
export class AppModule {}
