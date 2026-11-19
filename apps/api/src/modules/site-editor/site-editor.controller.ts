import { Controller, Get, Post, Param, Body, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { SiteEditorService } from './site-editor.service';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthenticatedRequest } from '../../auth/auth.types';

@UseGuards(AuthGuard)
@Controller('sites/:siteId/document')
export class SiteEditorController {
  constructor(private readonly service: SiteEditorService) {}

  @Get()
  async load(@Param('siteId', ParseUUIDPipe) siteId: string, @Req() req: AuthenticatedRequest) {
    return this.service.load(siteId, req.user.tenantId);
  }

  @Post()
  async save(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { document: any },
  ) {
    return this.service.save(siteId, req.user.tenantId, body.document, req.user.sub);
  }

  @Get('versions')
  async versions(@Param('siteId', ParseUUIDPipe) siteId: string, @Req() req: AuthenticatedRequest) {
    return this.service.listVersions(siteId, req.user.tenantId);
  }

  @Post('restore/:version')
  async restore(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Param('version') version: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.restore(siteId, Number(version), req.user.tenantId, req.user.sub);
  }
}
