import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { SitesController } from "./sites.controller";
import { PublicSitesController } from "./public-sites.controller";

@Module({
  imports: [JwtModule.register({}), PrismaModule, AuthModule],
  controllers: [SitesController, PublicSitesController],
})
export class SitesModule {}
