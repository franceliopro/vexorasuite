import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreativeBriefsController } from "./creative-briefs.controller";
import { CreativeBriefsService } from "./creative-briefs.service";

/** As rotas /api/marketing* já exigem o módulo MARKETING pela política de rotas. */
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [CreativeBriefsController],
  providers: [CreativeBriefsService],
})
export class CreativeBriefsModule {}
