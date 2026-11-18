import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SitesDeployController } from "./sites-deploy.controller";
import { SitesDeployService } from "./sites-deploy.service";

@Module({
  imports: [PrismaModule, AuthModule, JwtModule.register({})],
  controllers: [SitesDeployController],
  providers: [SitesDeployService],
  exports: [SitesDeployService],
})
export class SitesDeployModule {}
