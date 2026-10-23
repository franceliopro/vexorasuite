import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ContactsController } from "./contacts.controller";
import { ConversationsController } from "./conversations.controller";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { ChannelConnectionsController } from "./channels.controller";
import { WahaWebhookController } from "./waha-webhook.controller";
import { WahaService } from "./waha.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ContactsController, ConversationsController, EventsController, ChannelConnectionsController, WahaWebhookController],
  providers: [EventsService, WahaService],
})
export class OperationsModule {}
