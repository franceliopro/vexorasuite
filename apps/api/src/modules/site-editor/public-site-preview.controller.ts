import { Controller, Get, Header, Param } from '@nestjs/common';
import { SitePreviewService } from './site-preview.service';

/**
 * Link temporário gerado no editor. Não há AuthGuard: o visitante só precisa do
 * JWT assinado, que expira em duas horas. O HTML devolvido é o rascunho salvo,
 * marcado como não publicado, sem formulários ativos e sem efeito externo.
 */
@Controller('public/sites/preview')
export class PublicSitePreviewController {
  constructor(private readonly service: SitePreviewService) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async preview(@Param('token') token: string): Promise<string> {
    return this.service.render(token);
  }
}
