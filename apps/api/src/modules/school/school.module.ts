import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../../auth/auth.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { SchoolController } from "./school.controller";
import { SchoolImageController } from "./school-image.controller";
import { SchoolReadService } from "./school-read.service";
import { SchoolService } from "./school.service";

/** Rotas /api/school* exigem SCHOOL pela política de rotas. */
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [SchoolController, SchoolImageController],
  providers: [SchoolService, SchoolReadService],
})
export class SchoolModule {}
