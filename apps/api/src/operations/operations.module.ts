import { TrackController, TrackIngestController, TrackService } from "./track.controller";
import {InboxesController} from "./inboxes.controller";
import {CopilotController} from "./copilot.controller";
import { PublicFlowController } from "./public-flow.controller";
import {NotificationSettingsController} from "./notification-settings.controller";
import { NotificationPreferencesController } from "./notification-preferences.controller";
import {DepartmentResourcesController} from './department-resources.controller';
import {DepartmentResourcesService} from './department-resources.service';
import {BusinessTemplatesController} from './business-templates.controller';
import {AudioTriageService} from './audio-triage.service';
import {VoiceService} from '../ai/voice.service';
import {CrmPipelinesController} from './crm-pipelines.controller';
import { TeamController } from './team.controller';
import { UserProfileController } from "./user-profile.controller";
import { ChannelHealthService } from "./channel-health.service";
import { JobLeaseService } from "../common/job-lease.service";
import { PushService } from "./push.service";
import { PushController } from "./push.controller";
import { RemindersController } from "./reminders.controller";
import { DemoController } from "./demo.controller";
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
import { EventsModule } from "./events.module";
import { ChannelConnectionsController } from "./channels.controller";
import { WahaWebhookController } from "./waha-webhook.controller";
import { WahaService } from "./waha.service";
import { ZernioService } from "./zernio.service";
import { ZernioConnectionsController } from "./zernio-connections.controller";
import { InstagramAutomationsController } from "./instagram-automations.controller";
import { ZernioWebhookController } from "./zernio-webhook.controller";
import { DepartmentsController } from "./departments.controller";
import { AsaasController } from "./asaas.controller";
import { AsaasService } from "./asaas.service";
import { AsaasWebhookController } from "./asaas-webhook.controller";
import { AsaasCustomerSyncScheduler } from "./asaas-customer-sync.scheduler";
import { StripeController } from "./stripe.controller";
import { StripeService } from "./stripe.service";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { InfinitePayController } from "./infinitepay.controller";
import { InfinitePayService } from "./infinitepay.service";
import { InfinitePayWebhookController } from "./infinitepay-webhook.controller";
import { PaymentRecordsService } from "./payment-records.service";
import { ReportsController } from "./reports.controller";
import { FinanceController } from "./finance.controller";
import { FinanceProvidersService } from "./finance-providers.service";
import { InfinitePayFinanceService } from "./infinite-pay-finance.service";
import { InboundCaptureController } from "./inbound-capture.controller";
import { InboundCaptureService } from "./inbound-capture.service";
import { BillingFollowUpPolicyController } from "./billing-follow-up-policy.controller";
import { ServiceProtocolsController } from "./service-protocols.controller";
import { ServiceProtocolsService } from "./service-protocols.service";
import { TestEnvironmentController } from "./test-environment.controller";
import { TestEnvironmentResetService } from "./test-environment-reset.service";
import { ConversationDistributionService } from "./conversation-distribution.service";
import { SupervisionController } from "./supervision.controller";
import { PublicApiController } from "./public-api.controller";
import { McpController } from "./mcp.controller";
import { DocumentsController } from "./documents.controller";
import { BillingController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";
import { MetaWebhookController } from "./meta-webhook.controller";
import { MetaService } from "./meta.service";
import { CatalogController } from "./catalog.controller";
import { WebhooksController } from "./webhooks.controller";
import { MailModule } from "../mail/mail.module";

@Module({
  // AuthGuard is applied directly to controllers in this module. Register JwtModule
  // here as well so Nest can resolve JwtService in the OperationsModule context.
  imports: [AuthModule, JwtModule.register({}), PrismaModule, MailModule, EventsModule],
  controllers: [TrackController, TrackIngestController, InboxesController,CopilotController, PublicFlowController, NotificationSettingsController, NotificationPreferencesController, DepartmentResourcesController, BusinessTemplatesController, CrmPipelinesController, TeamController, UserProfileController, PushController, ContactAvatarController, OverviewController, IntelligenceRuntimeController, TasksController, RemindersController, DemoController, GoogleCalendarController, GoogleOAuthController, ContactsController, ConversationsController, EventsController, ChannelConnectionsController, WahaWebhookController, ZernioWebhookController, ZernioConnectionsController, InstagramAutomationsController, DepartmentsController, AsaasController, AsaasWebhookController, StripeController, StripeWebhookController, InfinitePayController, InfinitePayWebhookController, ReportsController, SupervisionController, FinanceController, BillingFollowUpPolicyController, InboundCaptureController, ServiceProtocolsController, TestEnvironmentController, PublicApiController, WebhooksController, McpController, DocumentsController, BillingController, BillingWebhookController, MetaWebhookController, CatalogController],
  providers: [TrackService, JobLeaseService, DepartmentResourcesService, AudioTriageService, VoiceService, ChannelHealthService, PushService, GoogleAccessService, AiService, IntelligenceRuntimeService, WahaService, ZernioService, AsaasService, AsaasCustomerSyncScheduler, StripeService, InfinitePayService, PaymentRecordsService, FinanceProvidersService, InfinitePayFinanceService, ServiceProtocolsService, TestEnvironmentResetService, ConversationDistributionService, MetaService, InboundCaptureService],
  exports: [WahaService, ZernioService, JobLeaseService],
})
export class OperationsModule {}




