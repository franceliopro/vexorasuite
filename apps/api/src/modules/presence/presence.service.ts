import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuthenticatedRequest } from '../../auth/auth.types';
import { CloudflareService } from '../sites-deploy/cloudflare.service';

/**
 * Presença = referências de sites já publicados fora da Véxora + artes produzidas
 * e publicadas pelo orquestrador. Nada é marcado como publicado sem 2xx no ar.
 * Os registros ficam em integrations.presence, sempre dentro do tenant atual.
 */
type ExternalSite = { id: string; title: string; url: string; description: string; addedBy: string; addedAt: string };
type Artwork = {
  id: string; title: string; headline: string; subtitle: string; cta: string;
  colors: { background: string; accent: string; text: string };
  svgBase64: string; sha256: string; status: 'READY' | 'PUBLISHED' | 'FAILED';
  url: string | null; verifiedAt: string | null; error: string | null;
  createdBy: string; createdAt: string;
};
type Presence = { externalSites: ExternalSite[]; artworks: Artwork[] };

const obj = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const text = (value: unknown, max: number): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const hex = (value: unknown, fallback: string): string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback;
const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
const isManager = (role: string) => ['OWNER', 'ADMIN', 'MANAGER'].includes(role);

function readPresence(root: unknown): Presence {
  const value = obj(obj(root).presence);
  return {
    externalSites: Array.isArray(value.externalSites) ? value.externalSites.slice(0, 30) : [],
    artworks: Array.isArray(value.artworks) ? value.artworks.slice(0, 20) : [],
  };
}

/** SVG simples e determinístico: a Véxora produz a peça, sem depender de arte externa. */
export function renderArtworkSvg(input: { headline: string; subtitle: string; cta: string; colors: { background: string; accent: string; text: string } }): string {
  const { background, accent, text: textColor } = input.colors;
  const headline = escapeXml(text(input.headline, 80));
  const subtitle = escapeXml(text(input.subtitle, 240));
  const cta = escapeXml(text(input.cta, 40));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${headline}">
<rect width="1200" height="630" fill="${background}"/>
<rect x="0" y="0" width="16" height="630" fill="${accent}"/>
<g font-family="Inter, Arial, sans-serif" fill="${textColor}">
<text x="72" y="118" font-size="26" font-weight="700" letter-spacing="3" fill="${accent}">VEXORA · CRIATIVO</text>
<text x="72" y="280" font-size="66" font-weight="800">${headline}</text>
<text x="72" y="360" font-size="30">${subtitle}</text>
<rect x="72" y="452" rx="10" width="${Math.max(180, cta.length * 18 + 64)}" height="68" fill="${accent}"/>
<text x="104" y="496" font-size="28" font-weight="700" fill="${background}">${cta}</text>
<text x="72" y="580" font-size="20" opacity="0.75">Produzido e publicado pelo orquestrador Véxora</text>
</g></svg>`;
}

/** Cada deploy é um snapshot completo: incluir as artes já publicadas evita quebrar links anteriores. */
function artworkPage(artwork: Artwork): string {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXml(artwork.title)}</title><body style="margin:0;background:#0b0e12"><img src="../${artwork.id}.svg" alt="${escapeXml(artwork.title)}" style="width:100%;height:auto;display:block"></body></html>`;
}

function artworkIndex(artworks: Artwork[]): string {
  const links = artworks.map(item => `<li><a href="./${item.id}/index.html" style="color:#FACC15">${escapeXml(item.title)}</a></li>`).join('');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Véxora · Artes</title><body style="margin:0;background:#0b0e12;color:#fff;font-family:Arial"><main style="max-width:960px;margin:48px auto;padding:0 20px"><h1>Artes Véxora</h1><ul>${links}</ul></main></body></html>`;
}

@Injectable()
export class PresenceService {
  constructor(private readonly prisma: PrismaService, private readonly cf: CloudflareService) {}

  private async mutate(req: AuthenticatedRequest, change: (presence: Presence) => void): Promise<Presence> {
    if (!isManager(req.user.role)) throw new ForbiddenException('Somente responsáveis pela empresa podem alterar sites e artes.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const root = obj(tenant.integrations);
      const presence = readPresence(root);
      change(presence);
      await tx.tenant.update({
        where: { id: req.user.tenantId },
        data: { integrations: { ...root, presence: presence as unknown as Prisma.InputJsonObject } as Prisma.InputJsonObject },
      });
      return presence;
    });
  }

  async list(req: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    const presence = readPresence(tenant.integrations);
    return {
      externalSites: presence.externalSites,
      artworks: presence.artworks.map(({ svgBase64: _svgBase64, ...meta }) => meta),
      cloudflareConfigured: this.cf.isConfigured(),
    };
  }

  async svg(req: AuthenticatedRequest, id: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    const artwork = readPresence(tenant.integrations).artworks.find(item => item.id === id);
    if (!artwork) throw new NotFoundException('Arte não encontrada nesta empresa.');
    return { id: artwork.id, title: artwork.title, svgBase64: artwork.svgBase64, sha256: artwork.sha256, status: artwork.status, url: artwork.url };
  }

  async addExternalSite(req: AuthenticatedRequest, body: { title?: string; url?: string; description?: string }) {
    const title = text(body?.title, 80), description = text(body?.description, 240);
    let parsed: URL;
    try { parsed = new URL(text(body?.url, 500)); } catch { throw new BadRequestException('Informe uma URL válida.'); }
    if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) throw new BadRequestException('Use uma URL https com domínio válido.');
    if (!title) throw new BadRequestException('Informe o título do site.');
    const site: ExternalSite = {
      id: `site-${randomBytes(5).toString('hex')}`,
      title, url: parsed.toString().slice(0, 500), description,
      addedBy: req.user.sub, addedAt: new Date().toISOString(),
    };
    const presence = await this.mutate(req, value => {
      if (value.externalSites.some(item => item.url === site.url)) throw new BadRequestException('Este endereço já está cadastrado na empresa.');
      value.externalSites.unshift(site);
      value.externalSites = value.externalSites.slice(0, 30);
    });
    return { externalSites: presence.externalSites };
  }

  async removeExternalSite(req: AuthenticatedRequest, id: string) {
    const presence = await this.mutate(req, value => {
      const before = value.externalSites.length;
      value.externalSites = value.externalSites.filter(item => item.id !== id);
      if (value.externalSites.length === before) throw new NotFoundException('Site não encontrado nesta empresa.');
    });
    return { externalSites: presence.externalSites };
  }

  async createArtwork(req: AuthenticatedRequest, body: { title?: string; headline?: string; subtitle?: string; cta?: string; colors?: Record<string, string> }) {
    const title = text(body?.title, 80), headline = text(body?.headline, 80), subtitle = text(body?.subtitle, 240), cta = text(body?.cta, 40);
    if (!title || !headline || !cta) throw new BadRequestException('Informe título, manchete e chamada da arte.');
    const colors = {
      background: hex(obj(body?.colors).background, '#101317'),
      accent: hex(obj(body?.colors).accent, '#FACC15'),
      text: hex(obj(body?.colors).text, '#FFFFFF'),
    };
    const svg = renderArtworkSvg({ headline, subtitle, cta, colors });
    const artwork: Artwork = {
      id: `arte-${randomBytes(5).toString('hex')}`, title, headline, subtitle, cta, colors,
      svgBase64: Buffer.from(svg, 'utf8').toString('base64'),
      sha256: createHash('sha256').update(svg).digest('hex'),
      status: 'READY', url: null, verifiedAt: null, error: null,
      createdBy: req.user.sub, createdAt: new Date().toISOString(),
    };
    const presence = await this.mutate(req, value => {
      value.artworks.unshift(artwork);
      value.artworks = value.artworks.slice(0, 20);
    });
    return { artworks: presence.artworks.map(({ svgBase64: _svgBase64, ...meta }) => meta), artwork: { ...artwork, svgBase64: artwork.svgBase64 } };
  }

  /** Publica no Pages da Cloudflare e só confirma depois de 2xx na URL final. */
  async publishArtwork(req: AuthenticatedRequest, id: string) {
    if (!isManager(req.user.role)) throw new ForbiddenException('Somente responsáveis pela empresa podem publicar artes.');
    if (!this.cf.isConfigured()) throw new BadRequestException('Cloudflare não configurado nesta instalação. A arte foi mantida como rascunho.');
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    const current = readPresence(tenant.integrations);
    const artwork = current.artworks.find(item => item.id === id);
    if (!artwork) throw new NotFoundException('Arte não encontrada nesta empresa.');

    const project = `vexora-presenca-${req.user.tenantId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 58);
    const alreadyPublished = current.artworks.filter(item => item.status === 'PUBLISHED' && item.id !== id);
    const included = [artwork, ...alreadyPublished];
    const files = [
      { path: 'index.html', content: Buffer.from(artworkIndex(included), 'utf8') },
      ...included.flatMap(item => [
        { path: `${item.id}.svg`, content: Buffer.from(Buffer.from(item.svgBase64, 'base64').toString('utf8'), 'utf8') },
        { path: `${item.id}/index.html`, content: Buffer.from(artworkPage(item), 'utf8') },
      ]),
    ];

    try {
      try { await this.cf.getProject(project); } catch { await this.cf.createProject(project); }
      await this.cf.createDeployment(project, files);
    } catch (error) {
      await this.mark(req, id, { status: 'FAILED', error: 'Falha no envio para a Cloudflare.' });
      throw error;
    }

    // URL estável do projeto, não a URL transitória do deployment; é nela que o link publicado é verificado.
    const target = `https://${project}.pages.dev/${artwork.id}/index.html`;
    let verified = false;
    try {
      const response = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      verified = response.ok;
      await response.arrayBuffer().catch(() => undefined);
    } catch { verified = false; }
    if (!verified) {
      await this.mark(req, id, { status: 'FAILED', error: 'Deploy enviado, mas a URL não respondeu 2xx. Publicação não confirmada.' });
      throw new BadRequestException('Deploy enviado, mas a URL não respondeu 2xx. Publicação não confirmada.');
    }
    await this.mark(req, id, { status: 'PUBLISHED', url: target, verifiedAt: new Date().toISOString(), error: null });
    return { id, status: 'PUBLISHED', url: target, verified: true };
  }

  private async mark(req: AuthenticatedRequest, id: string, patch: Partial<Artwork>) {
    await this.mutate(req, value => {
      const artwork = value.artworks.find(item => item.id === id);
      if (!artwork) throw new NotFoundException('Arte não encontrada nesta empresa.');
      Object.assign(artwork, patch);
    });
  }
}
