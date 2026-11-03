import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailController } from "./mail.controller";
import { MailService } from "./mail.service";

@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
