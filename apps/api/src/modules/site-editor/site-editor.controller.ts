import { Controller, Get, Post, Param, Body, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { SiteEditorService } from './site-editor.service';
import { SiteAiService } from './site-ai.service';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthenticatedRequest } from '../../auth/auth.types';

@UseGuards(AuthGuard)
@Controller('sites/:siteId/document')
export class SiteEditorController {
  constructor(
    private readonly service: SiteEditorService,
    private readonly ai: SiteAiService,
  ) {}

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

  /**
   * Ajusta um bloco a partir do prompt da caixa de IA. Obrigatoriamente autenticado e
   * tenant-scoped; o resultado volta como patch para revisão humana, sem salvar sozinho.
   */
  @Post('ai-edit')
  async aiEdit(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: { node?: unknown; prompt?: unknown },
  ) {
    return this.ai.edit(siteId, req.user.tenantId, req.user.sub, body?.node, body?.prompt);
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
