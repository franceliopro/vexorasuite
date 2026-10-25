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
import { ZernioService } from "./zernio.service";
import { ZernioWebhookController } from "./zernio-webhook.controller";
import { DepartmentsController } from "./departments.controller";
import { AsaasController } from "./asaas.controller";
import { AsaasService } from "./asaas.service";
import { AsaasWebhookController } from "./asaas-webhook.controller";
import { AsaasCustomerSyncScheduler } from "./asaas-customer-sync.scheduler";
import { ReportsController } from "./reports.controller";
import { ServiceProtocolsController } from "./service-protocols.controller";
import { ServiceProtocolsService } from "./service-protocols.service";

@Module({
  // AuthGuard is applied directly to controllers in this module. Register JwtModule
  // here as well so Nest can resolve JwtService in the OperationsModule context.
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [ContactsController, ConversationsController, EventsController, ChannelConnectionsController, WahaWebhookController, ZernioWebhookController, DepartmentsController, AsaasController, AsaasWebhookController, ReportsController, ServiceProtocolsController],
  providers: [EventsService, WahaService, ZernioService, AsaasService, AsaasCustomerSyncScheduler, ServiceProtocolsService],
})
export class OperationsModule {}
