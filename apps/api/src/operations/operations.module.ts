import {InboxesController} from "./inboxes.controller";
import {CopilotController} from "./copilot.controller";
import {HomePresentationController} from "./home-presentation.controller";
import {NotificationSettingsController} from "./notification-settings.controller";
import {DepartmentResourcesController} from './department-resources.controller';
import {DepartmentResourcesService} from './department-resources.service';
import {BusinessTemplatesController} from './business-templates.controller';
import {AudioTriageService} from './audio-triage.service';
import {VoiceService} from '../ai/voice.service';
import {CrmPipelinesController} from './crm-pipelines.controller';
import { TeamController } from './team.controller';
import { UserProfileController } from "./user-profile.controller";
import { ChannelHealthService } from "./channel-health.service";
import { PushService } from "./push.service";
import { PushController } from "./push.controller";
import { ContactAvatarController } from "./contact-avatar.controller";
import { OverviewController } from "./overview.controller";
import { GoogleAccessService } from "./google-access.service";
import { AiService } from "../ai/ai.service";
import { IntelligenceRuntimeController } from "./intelligence-runtime.controller";
import { IntelligenceRuntimeService } from "./intelligence-runtime.service";
import { TasksController } from "./tasks.controller";
import { GoogleCalendarController } from "./google-calendar.controller";
import { GoogleOAuthController } from "./google-oauth.controller";
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
import { FinanceController } from "./finance.controller";
import { ServiceProtocolsController } from "./service-protocols.controller";
import { ServiceProtocolsService } from "./service-protocols.service";

@Module({
  // AuthGuard is applied directly to controllers in this module. Register JwtModule
  // here as well so Nest can resolve JwtService in the OperationsModule context.
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [InboxesController,CopilotController,HomePresentationController, NotificationSettingsController, DepartmentResourcesController, BusinessTemplatesController, CrmPipelinesController, TeamController, UserProfileController, PushController, ContactAvatarController, OverviewController, IntelligenceRuntimeController, TasksController, GoogleCalendarController, GoogleOAuthController, ContactsController, ConversationsController, EventsController, ChannelConnectionsController, WahaWebhookController, ZernioWebhookController, DepartmentsController, AsaasController, AsaasWebhookController, ReportsController, FinanceController, ServiceProtocolsController],
  providers: [DepartmentResourcesService, AudioTriageService, VoiceService, ChannelHealthService, PushService, GoogleAccessService, AiService, IntelligenceRuntimeService, EventsService, WahaService, ZernioService, AsaasService, AsaasCustomerSyncScheduler, ServiceProtocolsService],
})
export class OperationsModule {}


