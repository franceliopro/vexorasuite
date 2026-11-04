import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EventsService } from "./events.service";

@Module({
  imports: [PrismaModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
