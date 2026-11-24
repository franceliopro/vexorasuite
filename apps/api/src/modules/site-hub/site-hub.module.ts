import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { SiteHubController } from "./site-hub.controller";
import { SiteHubService } from "./site-hub.service";
import { DirectusSubmissionsService } from "./directus-submissions.service";
import { SiteSubmissionsController } from "./site-submissions.controller";
import { SiteSubmissionsService } from "./site-submissions.service";

/** As rotas /api/sites* já exigem o módulo SITES pela política de rotas. */
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [SiteHubController, SiteSubmissionsController],
  providers: [SiteHubService, DirectusSubmissionsService, SiteSubmissionsService],
})
export class SiteHubModule {}
