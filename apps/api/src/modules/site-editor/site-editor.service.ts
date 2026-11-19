import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SiteEditorService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedSite(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId }, select: { id: true } });
    if (!site) throw new NotFoundException('Site não encontrado');
    return site;
  }

  async load(siteId: string, tenantId: string) {
    await this.ownedSite(siteId, tenantId);
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  async save(siteId: string, tenantId: string, document: any, createdBy: string) {
    await this.ownedSite(siteId, tenantId);
    const existing = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (existing) {
      const nextVersion = existing.version + 1;
      await this.prisma.siteVersion.create({
        data: { siteDocumentId: existing.id, version: existing.version, document: existing.document as any, createdBy },
      });
      return this.prisma.siteDocument.update({
        where: { siteId },
        data: { document, version: nextVersion },
      });
    }
    return this.prisma.siteDocument.create({
      data: { siteId, document, version: 1 },
    });
  }

  async listVersions(siteId: string, tenantId: string) {
    await this.ownedSite(siteId, tenantId);
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return this.prisma.siteVersion.findMany({
      where: { siteDocumentId: doc.id },
      orderBy: { version: 'desc' },
    });
  }

  async restore(siteId: string, version: number, tenantId: string, createdBy: string) {
    await this.ownedSite(siteId, tenantId);
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    const v = await this.prisma.siteVersion.findUnique({
      where: { siteDocumentId_version: { siteDocumentId: doc.id, version } },
    });
    if (!v) throw new NotFoundException('Versão não encontrada');
    return this.save(siteId, tenantId, v.document, createdBy);
  }
}
