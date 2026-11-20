import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { SiteFormsService } from "./site-forms.service";
import { SiteFormsController } from "./site-forms.controller";
import { PublicSiteFormsController } from "./public-site-forms.controller";

@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [SiteFormsController, PublicSiteFormsController],
  providers: [SiteFormsService],
  exports: [SiteFormsService],
})
export class SiteFormsModule {}
