import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { AuditCovered } from "../common/audit/audit.decorator";
import { SitesDeployService } from "./sites-deploy.service";

/**
 * Publicação de sites em domínio próprio via Cloudflare Pages.
 *
 * O token da Cloudflare é da conta do próprio cliente (BYO), criptografado em
 * `tenants.integrations.cloudflare`; nunca é enviado em cada deploy.
 */
@AuditCovered()
@Controller("sites")
@UseGuards(AuthGuard)
export class SitesDeployController {
  constructor(private readonly sites: SitesDeployService) {}

  private management(req: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) {
      throw new ForbiddenException("Somente gestão pode publicar sites e configurar domínios.");
    }
  }

  @Get("deploy/config")
  async connection(@Req() req: AuthenticatedRequest) {
    return this.sites.connection(req.user.tenantId);
  }

  @Put("deploy/config")
  async saveConnection(@Req() req: AuthenticatedRequest, @Body() body: { apiToken?: unknown; accountId?: unknown }) {
    this.management(req);
    return this.sites.saveConnection(req.user.tenantId, req.user.sub, body ?? {});
  }

  @Delete("deploy/config")
  async removeConnection(@Req() req: AuthenticatedRequest) {
    this.management(req);
    return this.sites.removeConnection(req.user.tenantId, req.user.sub);
  }

  @Get(":siteId/deployments")
  async list(@Req() req: AuthenticatedRequest, @Param("siteId", ParseUUIDPipe) siteId: string, @Query("limit") limit?: string) {
    return this.sites.listDeployments(req.user.tenantId, siteId, limit ? Number(limit) : 20);
  }

  @Post(":siteId/deploy")
  async deploy(@Req() req: AuthenticatedRequest, @Param("siteId", ParseUUIDPipe) siteId: string, @Body() body: { branch?: unknown; commitMessage?: unknown; force?: unknown }) {
    this.management(req);
    return this.sites.deploy(req.user.tenantId, req.user.sub, siteId, body ?? {});
  }

  @Get("deploy/deployments/:deploymentId")
  async getDeployment(@Req() req: AuthenticatedRequest, @Param("deploymentId", ParseUUIDPipe) deploymentId: string) {
    return this.sites.getDeployment(req.user.tenantId, deploymentId);
  }

  @Post("deploy/deployments/:deploymentId/refresh")
  async refreshDeployment(@Req() req: AuthenticatedRequest, @Param("deploymentId", ParseUUIDPipe) deploymentId: string) {
    this.management(req);
    return this.sites.refreshDeployment(req.user.tenantId, deploymentId);
  }

  @Get(":siteId/domain")
  async domain(@Req() req: AuthenticatedRequest, @Param("siteId", ParseUUIDPipe) siteId: string) {
    return this.sites.domainStatusFor(req.user.tenantId, siteId);
  }

  @Post(":siteId/domain")
  async attachDomain(@Req() req: AuthenticatedRequest, @Param("siteId", ParseUUIDPipe) siteId: string, @Body() body: { hostname?: unknown }) {
    this.management(req);
    if (!body || body.hostname === undefined) throw new BadRequestException("Informe o domínio do site.");
    return this.sites.attachDomain(req.user.tenantId, req.user.sub, siteId, body);
  }

  @Post(":siteId/domain/verify")
  async verifyDomain(@Req() req: AuthenticatedRequest, @Param("siteId", ParseUUIDPipe) siteId: string) {
    this.management(req);
    return this.sites.verifyDomain(req.user.tenantId, req.user.sub, siteId);
  }

  @Delete(":siteId/domain")
  async removeDomain(@Req() req: AuthenticatedRequest, @Param("siteId", ParseUUIDPipe) siteId: string) {
    this.management(req);
    return this.sites.removeDomain(req.user.tenantId, req.user.sub, siteId);
  }
}
