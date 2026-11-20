import { Controller, Get, Param, Query, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthenticatedRequest } from '../../auth/auth.types';
import { SiteFormsService } from './site-forms.service';

/**
 * Leitura das respostas recebidas. Exige autenticação, módulo SITES e pertencimento
 * da empresa — o service confirma o tenant antes de devolver qualquer dado.
 */
@UseGuards(AuthGuard)
@Controller('sites/:siteId/forms')
export class SiteFormsController {
  constructor(private readonly service: SiteFormsService) {}

  @Get('submissions')
  async submissions(
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Query('limit') limit: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(siteId, req.user.tenantId, Number(limit));
  }
}
