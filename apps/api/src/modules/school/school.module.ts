import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { SchoolController } from "./school.controller";
import { SchoolReadService } from "./school-read.service";
import { SchoolService } from "./school.service";

/** Rotas /api/school* exigem CALENDAR pela política de rotas. */
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [SchoolController],
  providers: [SchoolService, SchoolReadService],
})
export class SchoolModule {}
