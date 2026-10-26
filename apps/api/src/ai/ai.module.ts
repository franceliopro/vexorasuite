import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AiService } from "./ai.service";
import { AuthorizedContactsController } from "./authorized-contacts.controller";
import { AssistantController } from "./assistant.controller";
import { ChatbotDraftController } from "./chatbot-draft.controller";
import { ChatbotTriggerPreviewController } from "./chatbot-trigger-preview.controller";
import { GoogleCalendarController } from "../operations/google-calendar.controller";

@Module({ imports: [PrismaModule, AuthModule, JwtModule.register({})], controllers: [AssistantController, AuthorizedContactsController, ChatbotDraftController, ChatbotTriggerPreviewController], providers: [AiService, GoogleCalendarController], exports: [AiService] })
export class AiModule {}
