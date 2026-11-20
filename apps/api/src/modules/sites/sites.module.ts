import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";

// AuthGuard precisa de JwtService e do PrismaService canônico no contexto do módulo
// (mesmo padrão de OperationsModule, SitesDeployModule e SiteEditorModule).
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
