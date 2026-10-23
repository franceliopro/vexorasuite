import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { OperationsModule } from "./operations/operations.module";

@Module({
  imports: [PrismaModule, AuthModule, OperationsModule],
  controllers: [HealthController],
})
export class AppModule {}
