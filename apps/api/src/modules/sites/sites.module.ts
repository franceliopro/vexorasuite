import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";
import { SiteLayoutVisionService } from "./site-layout-vision.service";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AiModule } from "../../ai/ai.module";

// AuthGuard precisa de JwtService e do PrismaService canônico no contexto do módulo
// (mesmo padrão de OperationsModule, SitesDeployModule e SiteEditorModule).
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule, AiModule],
  controllers: [SitesController],
  providers: [SitesService, SiteLayoutVisionService],
  exports: [SitesService],
})
export class SitesModule {}
