import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AiService } from "./ai.service";
import { AuthorizedContactsController } from "./authorized-contacts.controller";
import { AssistantController } from "./assistant.controller";
import { GoogleCalendarController } from "../operations/google-calendar.controller";

@Module({ imports: [PrismaModule, AuthModule, JwtModule.register({})], controllers: [AssistantController, AuthorizedContactsController], providers: [AiService, GoogleCalendarController], exports: [AiService] })
export class AiModule {}
