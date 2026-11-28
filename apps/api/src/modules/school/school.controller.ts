import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { SchoolReadService } from "./school-read.service";
import { SchoolService } from "./school.service";

/**
 * Gestão escolar no banco principal. Leituras e escritas usam somente o tenant
 * da sessão. Avisos e mensalidades ficam SCHEDULED: nenhum envio ou cobrança
 * real é executado por estas rotas.
 */
@UseGuards(AuthGuard)
@Controller("school")
export class SchoolController {
  constructor(
    private readonly service: SchoolService,
    private readonly read: SchoolReadService,
  ) {}

  @Get("snapshot")
  snapshot(@Req() req: AuthenticatedRequest) {
    return this.read.snapshot(req.user.tenantId);
  }

  @Get("default-courses")
  defaultCourses(@Req() req: AuthenticatedRequest) {
    return this.read.defaultCourses();
  }

  @Post("seed-default-courses")
  seedDefaultCourses(@Req() req: AuthenticatedRequest) {
    return this.service.seedDefaultCourses(req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post("records")
  createRecord(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.createRecord(body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post("attendances")
  recordAttendance(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.recordAttendance(body, req.user.tenantId, req.user.role, req.user.sub);
  }
}
