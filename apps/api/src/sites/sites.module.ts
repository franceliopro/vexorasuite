import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { MailModule } from "../mail/mail.module";
import { OperationsModule } from "../operations/operations.module";
import { SitesController } from "./sites.controller";
import { SitesAssetsController } from "./sites-assets.controller";
import { PublicAssetsController } from "./public-assets.controller";
import { PublicSitesController } from "./public-sites.controller";
import { ImageGenerationController } from "../ai/image-generation.controller";

@Module({
  imports: [JwtModule.register({}), PrismaModule, AuthModule, AiModule, MailModule, OperationsModule],
  controllers: [SitesController, SitesAssetsController, PublicSitesController, PublicAssetsController, ImageGenerationController],
})
export class SitesModule {}
