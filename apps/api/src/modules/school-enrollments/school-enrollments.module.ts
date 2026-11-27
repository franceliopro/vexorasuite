import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../../auth/auth.module";
import { OperationsModule } from "../../operations/operations.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { DocumensoClient } from "./documenso.client";
import { SchoolEnrollmentsController } from "./school-enrollments.controller";
import { SchoolEnrollmentsService } from "./school-enrollments.service";

/** Rotas /api/school-enrollments exigem SCHOOL; o formulário público usa apenas o token. */
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule, OperationsModule],
  controllers: [SchoolEnrollmentsController],
  providers: [SchoolEnrollmentsService, DocumensoClient],
})
export class SchoolEnrollmentsModule {}
