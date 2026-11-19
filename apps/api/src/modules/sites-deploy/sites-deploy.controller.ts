import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SitesDeployService } from './sites-deploy.service';

// TODO: integrar guards reais do Véxora (JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('sites')
export class SitesDeployController {
  constructor(private readonly service: SitesDeployService) {}

  @Post(':id/domain')
  async bindDomain(@Param('id') id: string, @Body() body: { domain: string; tenantId: string }) {
    return this.service.bindDomain(id, body.domain, body.tenantId);
  }

  @Get(':id/domain/verify')
  async verifyDomain(@Param('id') id: string, @Body() body: { tenantId: string }) {
    return this.service.verifyDomain(id, body.tenantId);
  }

  @Post(':id/deploy')
  async deploy(
    @Param('id') id: string,
    @Body() body: { tenantId: string; files: { path: string; contentBase64: string }[] },
  ) {
    return this.service.deploy(id, body.tenantId, body.files);
  }
}