import { Body, Controller, Header, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SiteFormsService } from './site-forms.service';

type SubmitBody = { values?: unknown; website?: unknown; startedAt?: unknown };

/**
 * Endpoint público usado pelo formulário do site publicado. Não há AuthGuard: o
 * visitante não tem conta na Véxora. A proteção vem de três camadas no service:
 * site precisa estar publicado, bloco precisa existir no SiteDocument salvo e
 * limites de taxa/honeypot. O `Content-Type` aceito é `application/x-www-form-urlencoded`
 * (CORS-safelisted), então o navegador não precisa de preflight; o header explícito
 * libera a resposta para a origem do site hospedado fora da Véxora.
 */
@Controller('public/sites')
export class PublicSiteFormsController {
  constructor(private readonly service: SiteFormsService) {}

  @Post(':siteId/forms/:blockId/submit')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Cache-Control', 'no-store')
  async submit(
    @Param('siteId') siteId: string,
    @Param('blockId') blockId: string,
    @Body() body: SubmitBody,
    @Req() req: Request,
  ) {
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? 'unknown').slice(0, 80);
    return this.service.submit(siteId, blockId, body, ip);
  }
}
