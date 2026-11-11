import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { SitesController } from "./sites.controller";
import { PublicSitesController } from "./public-sites.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SitesController, PublicSitesController],
})
export class SitesModule {}
