import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { MusicSchoolController } from "./music-school.controller";
import { MusicSchoolService } from "./music-school.service";
import { MusicSchoolReadService } from "./music-school-read.service";

/** Rotas /api/music-school* exigem CALENDAR pela política de rotas. */
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MusicSchoolController],
  providers: [MusicSchoolService, MusicSchoolReadService],
})
export class MusicSchoolModule {}