import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EventsService } from "./events.service";
import { EventsAuthorizationService } from "./events-authorization.service";

@Module({
  imports: [PrismaModule],
  providers: [EventsService, EventsAuthorizationService],
  exports: [EventsService],
})
export class EventsModule {}
