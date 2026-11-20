import { Controller, Post, Get, Param, Body, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { SitesDeployService } from './sites-deploy.service';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthenticatedRequest } from '../../auth/auth.types';

@UseGuards(AuthGuard)
@Controller('sites')
export class SitesDeployController {
  constructor(private readonly service: SitesDeployService) {}

  @Post(':id/domain')
  async bindDomain(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { domain: string },
  ) {
    return this.service.bindDomain(id, body.domain, req.user.tenantId);
  }

  @Get(':id/domain/verify')
  async verifyDomain(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.service.verifyDomain(id, req.user.tenantId);
  }

  @Post(':id/deploy')
  async deploy(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    // O conteúdo publicado vem do SiteDocument salvo, nunca de arquivos enviados pelo navegador.
    return this.service.publishFromDocument(id, req.user.tenantId);
  }
}
