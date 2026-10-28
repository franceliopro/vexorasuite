import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkflowsService } from "./workflows.service";
import { WorkflowsController } from "./workflows.controller";
import { WahaService } from "../operations/waha.service";
@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  providers: [WorkflowsService, WahaService],
  controllers: [
    WorkflowsController,
  ],
  exports: [],
})
export class CommunicationsModule {}
