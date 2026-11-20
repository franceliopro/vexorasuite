/**
 * Prévia temporária do SiteDocument salvo.
 *
 * Não publica nada: gera um JWT de curta duração, assinado com o segredo já usado
 * pelo produto, e devolve um caminho público que renderiza o rascunho salvo com
 * aviso de não publicado e formulários desativados. O link existe para conferir a
 * aparência antes de publicar; expira sozinho e não cria deployment, domínio ou SSL.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma.service';
import { renderSiteHtml } from '../sites-deploy/site-html';

const TOKEN_KIND = 'site-preview';
const TTL_SECONDS = 2 * 60 * 60;
const MAX_TOKEN_CHARS = 2048;
const MIN_SECRET_BYTES = 32;

type PreviewClaims = {
  kind?: unknown;
  siteId?: unknown;
  tenantId?: unknown;
};

@Injectable()
export class SitePreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private secret(): string {
    const secret = (process.env.JWT_ACCESS_SECRET ?? '').trim();
    if (Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
      throw new BadRequestException('Prévia temporária indisponível: segredo de sessão não configurado.');
    }
    return secret;
  }

  /** Chamado somente pelo editor autenticado, depois de salvar o documento. */
  async create(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true },
    });
    if (!site) throw new NotFoundException('Site não encontrado');

    const document = await this.prisma.siteDocument.findUnique({
      where: { siteId },
      select: { version: true },
    });
    if (!document) {
      throw new BadRequestException('Salve o site no editor antes de gerar a prévia temporária.');
    }

    const token = await this.jwt.signAsync(
      { kind: TOKEN_KIND, siteId, tenantId, jti: randomUUID() },
      { secret: this.secret(), expiresIn: TTL_SECONDS },
    );

    return {
      token,
      path: `/api/public/sites/preview/${token}`,
      expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
      version: document.version,
    };
  }

  /** Endpoint sem AuthGuard: o portador do link consegue ver apenas este rascunho. */
  async render(token: string): Promise<string> {
    const raw = String(token ?? '').trim();
    if (!raw || raw.length > MAX_TOKEN_CHARS) {
      throw new BadRequestException('Endereço de prévia inválido.');
    }

    let claims: PreviewClaims;
    try {
      claims = await this.jwt.verifyAsync<PreviewClaims>(raw, { secret: this.secret() });
    } catch {
      throw new UnauthorizedException('Este endereço de prévia é inválido ou expirou.');
    }

    if (
      claims?.kind !== TOKEN_KIND ||
      typeof claims.siteId !== 'string' ||
      typeof claims.tenantId !== 'string'
    ) {
      throw new UnauthorizedException('Este endereço de prévia é inválido.');
    }

    const site = await this.prisma.site.findFirst({
      where: { id: claims.siteId, tenantId: claims.tenantId },
      select: { id: true, name: true, slug: true, primaryColor: true, accentColor: true },
    });
    if (!site) throw new NotFoundException('Prévia indisponível.');

    const document = await this.prisma.siteDocument.findUnique({
      where: { siteId: claims.siteId },
    });
    if (!document) throw new NotFoundException('Prévia indisponível.');

    return renderSiteHtml(document.document, site, {
      siteId: site.id,
      // Formulários não enviam nada durante a prévia; não existe endpoint aqui.
      apiBase: '',
      preview: true,
      previewLabel: 'Prévia temporária · rascunho não publicado · formulários desativados',
    });
  }
}
