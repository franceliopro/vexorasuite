import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { SitesController } from "./sites.controller";
import { SitesAssetsController } from "./sites-assets.controller";
import { PublicAssetsController } from "./public-assets.controller";
import { PublicSitesController } from "./public-sites.controller";

@Module({
  imports: [JwtModule.register({}), PrismaModule, AuthModule, AiModule],
  controllers: [SitesController, SitesAssetsController, PublicSitesController, PublicAssetsController],
})
export class SitesModule {}
