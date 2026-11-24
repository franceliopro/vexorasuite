import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { SiteSubmissionsService } from "./site-submissions.service";

/**
 * Anúncios do HUB de Sites: submissões do formulário público lidas do Directus.
 * A identidade do tenant vem da sessão; nenhum token do Directus chega ao cliente.
 */
@UseGuards(AuthGuard)
@Controller("sites/hub/submissions")
export class SiteSubmissionsController {
  constructor(private readonly service: SiteSubmissionsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user.tenantId, req.user.role);
  }

  @Post(":submissionKey/decide")
  decide(
    @Param("submissionKey") submissionKey: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.decide(submissionKey, body, req.user.tenantId, req.user.role, req.user.sub);
  }
}
