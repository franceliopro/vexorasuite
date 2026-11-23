import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { SiteHubService } from "./site-hub.service";

/**
 * HUB de Sites: governa pedido, preview, aprovação, versão, histórico e auditoria.
 * Não gera HTML, não hospeda página e não publica por conta própria — apenas registra
 * o que foi executado externamente e exige evidência 2xx para confirmar publicação.
 */
@UseGuards(AuthGuard)
@Controller("sites/hub/requests")
export class SiteHubController {
  constructor(private readonly service: SiteHubService) {}

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

  @Post(":id/preview")
  preview(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.registerPreview(id, body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post(":id/decision")
  decide(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.decide(id, body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post(":id/publish-request")
  requestPublish(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.requestPublish(id, body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post(":id/publish-confirm")
  confirmPublished(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.service.confirmPublished(id, req.user.tenantId, req.user.role, req.user.sub);
  }
}
