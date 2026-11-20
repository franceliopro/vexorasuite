import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CloudflareService } from './cloudflare.service';
import { createHash } from 'node:crypto';
import { renderSiteHtml } from './site-html';

@Injectable()
export class SitesDeployService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cf: CloudflareService,
  ) {}

  // --- Domínio ---

  async bindDomain(siteId: string, domain: string, tenantId: string) {
    const normalized = String(domain ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(normalized)) {
      throw new BadRequestException('Domínio inválido. Informe algo como www.exemplo.com.br.');
    }

    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) throw new NotFoundException('Site não encontrado');

    const projectName = this.projectName(site);

    // Idempotência: upsert por domínio
    const existing = await this.prisma.siteDomain.findUnique({ where: { domain: normalized } });
    if (existing && existing.siteId !== siteId) {
      throw new BadRequestException('Domínio já vinculado a outro site');
    }

    const domainRecord = existing
      ? await this.prisma.siteDomain.update({
          where: { id: existing.id },
          data: { siteId, status: 'PENDING_DNS', cfProjectName: projectName },
        })
      : await this.prisma.siteDomain.create({
          data: { siteId, domain: normalized, status: 'PENDING_DNS', cfProjectName: projectName },
        });

    // Cria projeto no Cloudflare Pages se necessário (idempotente: getProject primeiro)
    try {
      await this.cf.getProject(projectName);
    } catch {
      await this.cf.createProject(projectName);
    }

    // Vincula domínio customizado no projeto Pages
    try {
      await this.cf.addCustomDomain(projectName, normalized);
    } catch (e: any) {
      // já pode existir; não bloqueia
      if (!String(e.message).toLowerCase().includes('already')) {
        throw e;
      }
    }

    // DNS: se a zona do domínio estiver na conta Cloudflare do usuário, cria CNAME automaticamente
    // Tenta o domínio completo e depois o registrável (ex.: exemplo.com.br, não com.br).
    const labels = normalized.split('.');
    let zoneId: string | null = null;
    for (let i = 0; i < Math.min(2, labels.length); i += 1) {
      zoneId = await this.cf.getZoneId(labels.slice(i).join('.'));
      if (zoneId) break;
    }
    if (zoneId) {
      await this.prisma.siteDomain.update({
        where: { id: domainRecord.id },
        data: { cfZoneId: zoneId },
      });
      try {
        await this.cf.createDnsCname(zoneId, normalized, `${projectName}.pages.dev`, true);
      } catch (e: any) {
        // registro pode já existir
        if (!String(e.message).toLowerCase().includes('already')) {
          // não bloqueia o fluxo; usuário pode criar manualmente
        }
      }
    }

    return {
      domain: domainRecord.domain,
      status: domainRecord.status,
      projectName,
      cnameTarget: `${projectName}.pages.dev`,
      zoneFound: !!zoneId,
      instructions: zoneId
        ? null
        : `Crie um registro CNAME no seu provedor de DNS: ${domain} -> ${projectName}.pages.dev`,
    };
  }

  async verifyDomain(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) throw new NotFoundException('Site não encontrado');

    const domainRecord = await this.prisma.siteDomain.findFirst({ where: { siteId } });
    if (!domainRecord) throw new NotFoundException('Domínio não vinculado');

    const domains = await this.cf.listDomains(domainRecord.cfProjectName!);
    const match = domains.find((d: any) => d.name === domainRecord.domain);
    const sslStatus = match?.status ?? 'unknown';
    const active = match?.status === 'active';

    await this.prisma.siteDomain.update({
      where: { id: domainRecord.id },
      data: {
        status: active ? 'ACTIVE' : 'VERIFYING',
        sslStatus,
        verifiedAt: active ? new Date() : domainRecord.verifiedAt,
      },
    });

    return {
      domain: domainRecord.domain,
      status: active ? 'ACTIVE' : 'VERIFYING',
      sslStatus,
      verified: active,
    };
  }

  // --- Deploy ---

  /** Publica o SiteDocument salvo. O cliente nunca escolhe quais arquivos vão para o Pages. */
  async publishFromDocument(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true, name: true, slug: true, primaryColor: true, accentColor: true },
    });
    if (!site) throw new NotFoundException('Site não encontrado');
    if (!this.cf.isConfigured()) {
      throw new BadRequestException('Cloudflare não configurado nesta instalação. Avise a administração.');
    }
    const document = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!document) throw new BadRequestException('Salve o site no editor antes de publicar.');

    const html = renderSiteHtml(document.document, site);
    return this.deploy(siteId, tenantId, [
      { path: 'index.html', contentBase64: Buffer.from(html, 'utf8').toString('base64') },
    ]);
  }

  async deploy(siteId: string, tenantId: string, files: { path: string; contentBase64: string }[]) {
    if (!files.length || files.length > 200) {
      throw new BadRequestException('Nenhum arquivo válido para publicar.');
    }
    for (const file of files) {
      if (!/^[a-zA-Z0-9._/-]+$/.test(file.path) || file.path.includes('..') || file.contentBase64.length > 10_000_000) {
        throw new BadRequestException('Arquivo de publicação inválido.');
      }
    }
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) throw new NotFoundException('Site não encontrado');

    const domainRecord = await this.prisma.siteDomain.findFirst({ where: { siteId } });
    const projectName = this.projectName(site);

    // Idempotência por conteúdo
    const contentHash = createHash('sha256')
      .update(files.map((f) => f.path + f.contentBase64).join('|'))
      .digest('hex');

    const existing = await this.prisma.siteDeployment.findFirst({
      where: { siteId, contentHash, status: 'DEPLOYED' },
    });
    if (existing) {
      return { deploymentId: existing.id, status: 'DEPLOYED', url: existing.cfDeploymentUrl, idempotent: true };
    }

    const deployment = await this.prisma.siteDeployment.create({
      data: { siteId, domainId: domainRecord?.id, status: 'UPLOADING', contentHash },
    });

    try {
      const prepared = files.map((f) => ({
        path: f.path,
        content: Buffer.from(f.contentBase64, 'base64'),
      }));

      // garante projeto
      try {
        await this.cf.getProject(projectName);
      } catch {
        await this.cf.createProject(projectName);
      }

      const cfDeployment = await this.cf.createDeployment(projectName, prepared);

      await this.prisma.siteDeployment.update({
        where: { id: deployment.id },
        data: {
          status: 'DEPLOYED',
          cfDeploymentId: cfDeployment.id,
          cfDeploymentUrl: cfDeployment.url,
          finishedAt: new Date(),
        },
      });

      await this.prisma.site.update({
        where: { id: siteId },
        data: { domainStatus: 'LIVE' },
      });

      return { deploymentId: deployment.id, status: 'DEPLOYED', url: cfDeployment.url, idempotent: false };
    } catch (e: any) {
      await this.prisma.siteDeployment.update({
        where: { id: deployment.id },
        data: { status: 'FAILED', errorMessage: e.message, finishedAt: new Date() },
      });
      throw e;
    }
  }

  private projectName(site: any): string {
    // nome de projeto Cloudflare: lowercase, letras/dígitos/hífens
    const base = `${site.tenantId}-${site.slug}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return base.slice(0, 58) || `site-${site.id}`;
  }
}