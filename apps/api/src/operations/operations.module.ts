import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ContactsController } from "./contacts.controller";
import { ConversationsController } from "./conversations.controller";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { ChannelConnectionsController } from "./channels.controller";
import { WahaWebhookController } from "./waha-webhook.controller";
import { WahaService } from "./waha.service";
import { DepartmentsController } from "./departments.controller";
import { AsaasController } from "./asaas.controller";
import { AsaasService } from "./asaas.service";
import { AsaasWebhookController } from "./asaas-webhook.controller";
import { ReportsController } from "./reports.controller";

@Module({
  // AuthGuard is applied directly to controllers in this module. Register JwtModule
  // here as well so Nest can resolve JwtService in the OperationsModule context.
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [ContactsController, ConversationsController, EventsController, ChannelConnectionsController, WahaWebhookController, DepartmentsController, AsaasController, AsaasWebhookController, ReportsController],
  providers: [EventsService, WahaService, AsaasService],
})
export class OperationsModule {}
