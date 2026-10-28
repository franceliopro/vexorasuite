import { ProviderConnectionsController } from "./provider-connections.controller";
import { MarketingController } from "./marketing.controller";
import { DriveManagerController } from "./drive-manager.controller";
import { DriveManagerService } from "./drive-manager.service";
import { MarketingLibraryService } from "./marketing-library.service";
import { VoiceService } from "./voice.service";
import { VoiceController } from "./voice.controller";
import { CreativeReferencesService } from "./creative-references.service";
import { CreativeReferencesController } from "./creative-references.controller";
import { GoogleAccessService } from "../operations/google-access.service";
import { ZernioService } from "../operations/zernio.service";
import { AssistantAutomationService } from "./assistant-automation.service";
import { AssistantAutomationController, AssistantAutomationMediaController } from "./assistant-automation.controller";
import { ReportsController } from "../operations/reports.controller";
import { FinanceController } from "../operations/finance.controller";
import { AsaasService } from "../operations/asaas.service";
import { ReportExportService } from "./report-export.service";
import { ReportExportController } from "./report-export.controller";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AiService } from "./ai.service";
import { AuthorizedContactsController } from "./authorized-contacts.controller";
import { AssistantController } from "./assistant.controller";
import { ChatbotDraftController } from "./chatbot-draft.controller";
import { ChatbotAsaasPreviewController } from "./chatbot-asaas-preview.controller";
import { ChatbotTriggerPreviewController } from "./chatbot-trigger-preview.controller";
import { GoogleCalendarController } from "../operations/google-calendar.controller";

@Module({ imports: [PrismaModule, AuthModule, JwtModule.register({})], controllers: [ProviderConnectionsController, DriveManagerController, MarketingController, VoiceController, CreativeReferencesController, AssistantAutomationController, AssistantAutomationMediaController, ReportExportController, AssistantController, AuthorizedContactsController, ChatbotDraftController, ChatbotTriggerPreviewController, ChatbotAsaasPreviewController], providers: [DriveManagerService, MarketingLibraryService, VoiceService, CreativeReferencesService, GoogleAccessService, ZernioService, AssistantAutomationService, ReportsController, FinanceController, AsaasService, ReportExportService, AiService, GoogleCalendarController], exports: [AiService] })
export class AiModule {}

