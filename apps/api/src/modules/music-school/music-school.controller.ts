import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { MusicSchoolService } from "./music-school.service";

/**
 * Escola de Música: turmas, matrículas, presença e saldos no tenant autenticado.
 * Este slice apenas agenda cobrança; não envia mensagem, não cria cobrança externa
 * e nunca afirma pagamento sem evidência do provedor.
 */
@UseGuards(AuthGuard)
@Controller("music-school")
export class MusicSchoolController {
  constructor(private readonly service: MusicSchoolService) {}

  @Get("classes")
  listClasses(@Req() req: AuthenticatedRequest) {
    return this.service.listClasses(req.user.tenantId);
  }

  @Post("classes")
  createClass(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.createClass(body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post("classes/:classId/enrollments")
  enroll(
    @Req() req: AuthenticatedRequest,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.enroll(body, classId, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post("attendances")
  recordAttendance(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.recordAttendance(body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Get("attendances")
  listAttendances(
    @Req() req: AuthenticatedRequest,
    @Query("classId") classId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.listAttendances(req.user.tenantId, classId, from, to);
  }

  @Get("balances")
  listBalances(@Req() req: AuthenticatedRequest, @Query("contactId") contactId?: string) {
    return this.service.listBalances(req.user.tenantId, contactId);
  }
}