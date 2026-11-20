import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { SitesModule } from "../sites/sites.module";
import { SitesImportController } from "./sites-import.controller";
import { SitesImportService } from "./sites-import.service";

@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule, SitesModule],
  controllers: [SitesImportController],
  providers: [SitesImportService],
})
export class SitesImportModule {}
