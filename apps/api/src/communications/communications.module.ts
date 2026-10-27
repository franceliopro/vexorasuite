import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailService } from "./mail.service";
import { MailController, MailUnsubscribeController } from "./mail.controller";
import { WorkflowsService } from "./workflows.service";
import { WorkflowsController } from "./workflows.controller";
import { WahaService } from "../operations/waha.service";
import { GatewaysController } from "./gateways.controller";
@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  providers: [MailService, WorkflowsService, WahaService],
  controllers: [
    MailController,
    MailUnsubscribeController,
    WorkflowsController,
    GatewaysController,
  ],
  exports: [MailService],
})
export class CommunicationsModule {}
