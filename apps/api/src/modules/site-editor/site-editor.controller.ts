import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { SiteEditorService } from './site-editor.service';

@Controller('sites/:siteId/document')
export class SiteEditorController {
  constructor(private readonly service: SiteEditorService) {}

  @Get()
  async load(@Param('siteId') siteId: string, @Body() body: { tenantId: string }) {
    return this.service.load(siteId, body.tenantId);
  }

  @Post()
  async save(@Param('siteId') siteId: string, @Body() body: { tenantId: string; document: any; createdBy: string }) {
    return this.service.save(siteId, body.tenantId, body.document, body.createdBy);
  }

  @Get('versions')
  async versions(@Param('siteId') siteId: string) {
    return this.service.listVersions(siteId);
  }

  @Post('restore/:version')
  async restore(@Param('siteId') siteId: string, @Param('version') version: string, @Body() body: { createdBy: string }) {
    return this.service.restore(siteId, Number(version), body.createdBy);
  }
}