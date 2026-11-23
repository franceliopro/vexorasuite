import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { CreativeBriefsService } from "./creative-briefs.service";

/**
 * Intake de briefing criativo. Somente registro e histórico: não existe rota
 * para gerar, aprovar, publicar ou entregar peça a partir de um briefing.
 */
@UseGuards(AuthGuard)
@Controller("marketing/creative-briefs")
export class CreativeBriefsController {
  constructor(private readonly service: CreativeBriefsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.create(body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user.tenantId);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(req.user.tenantId, id);
  }
}
