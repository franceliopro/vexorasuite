import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailController } from "./mail.controller";
import { EmailMailboxController } from "./email-mailbox.controller";
import { MailService } from "./mail.service";
import { EmailMailboxService } from "./email-mailbox.service";
import { JobLeaseService } from "../common/job-lease.service";
import { EventsModule } from "../operations/events.module";
import { GoogleAccessService } from "../operations/google-access.service";

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule), JwtModule.register({}), EventsModule],
  controllers: [MailController, EmailMailboxController],
  providers: [MailService, EmailMailboxService, JobLeaseService, GoogleAccessService],
  exports: [MailService, EmailMailboxService],
})
export class MailModule {}
